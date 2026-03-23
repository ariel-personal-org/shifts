import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { addDays, format, startOfDay } from 'date-fns';
import * as schema from './schema';
import { eq, and } from 'drizzle-orm';

dotenv.config();

const {
  teams,
  users,
  schedules,
  shifts,
  scheduleMembers,
  shiftUsers,
  homeRequestShifts,
  notifications,
  auditLogs,
} = schema;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL required');

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  console.log('Seeding database...');

  // ─── Teams ──────────────────────────────────────────────────────────────────
  let alphaTeam = (await db.select().from(teams).where(eq(teams.name, 'Alpha Team')))[0];
  if (!alphaTeam) {
    [alphaTeam] = await db.insert(teams).values({ name: 'Alpha Team' }).returning();
    console.log('Created Alpha Team');
  }

  let betaTeam = (await db.select().from(teams).where(eq(teams.name, 'Beta Team')))[0];
  if (!betaTeam) {
    [betaTeam] = await db.insert(teams).values({ name: 'Beta Team' }).returning();
    console.log('Created Beta Team');
  }

  // ─── Users ──────────────────────────────────────────────────────────────────
  const seedUsers = [
    { name: 'Alice Admin', email: 'alice@example.com', is_admin: true, team_id: alphaTeam.id },
    { name: 'Bob Builder', email: 'bob@example.com', is_admin: false, team_id: alphaTeam.id },
    { name: 'Carol Chen', email: 'carol@example.com', is_admin: false, team_id: alphaTeam.id },
    { name: 'Dave Davis', email: 'dave@example.com', is_admin: false, team_id: betaTeam.id },
    { name: 'Eva Evans', email: 'eva@example.com', is_admin: false, team_id: betaTeam.id },
  ];

  const userMap: Record<string, typeof users.$inferSelect> = {};
  for (const u of seedUsers) {
    let existing = (await db.select().from(users).where(eq(users.email, u.email)))[0];
    if (!existing) {
      [existing] = await db.insert(users).values(u).returning();
      console.log(`Created user: ${u.name}`);
    }
    userMap[u.email] = existing;
  }

  const alice = userMap['alice@example.com'];
  const bob = userMap['bob@example.com'];
  const carol = userMap['carol@example.com'];
  const dave = userMap['dave@example.com'];

  // ─── Schedule ────────────────────────────────────────────────────────────────
  const today = startOfDay(new Date());
  const startDate = format(today, 'yyyy-MM-dd');
  const endDate = format(addDays(today, 13), 'yyyy-MM-dd');

  let schedule = (
    await db.select().from(schedules).where(eq(schedules.name, 'Demo Schedule'))
  )[0];

  if (!schedule) {
    [schedule] = await db
      .insert(schedules)
      .values({
        name: 'Demo Schedule',
        start_date: startDate,
        end_date: endDate,
        cycle_start_time: '09:00',
        shift_duration_hours: 12,
        capacity: 2,
        primary_team_id: alphaTeam.id,
      })
      .returning();
    console.log('Created Demo Schedule');

    // Generate shifts
    const [startHour, startMin] = [9, 0];
    const rangeStart = new Date(`${startDate}T00:00:00`);
    const rangeEnd = new Date(`${endDate}T23:59:59`);

    let shiftStart = new Date(rangeStart);
    shiftStart.setHours(startHour, startMin, 0, 0);

    const generatedShifts: Array<{ schedule_id: number; start_datetime: Date; end_datetime: Date; index: number }> = [];
    let idx = 0;
    while (shiftStart <= rangeEnd) {
      const shiftEnd = new Date(shiftStart.getTime() + 12 * 60 * 60 * 1000);
      generatedShifts.push({
        schedule_id: schedule.id,
        start_datetime: new Date(shiftStart),
        end_datetime: new Date(shiftEnd),
        index: idx,
      });
      shiftStart = shiftEnd;
      idx++;
    }

    await db.insert(shifts).values(generatedShifts);
    console.log(`Generated ${generatedShifts.length} shifts`);
  }

  // Get all shifts for this schedule
  const scheduleShifts = await db
    .select()
    .from(shifts)
    .where(eq(shifts.schedule_id, schedule.id))
    .orderBy(shifts.index);

  // ─── Schedule Members ────────────────────────────────────────────────────────
  const membersToAdd = [alice, bob, carol, dave];
  for (const user of membersToAdd) {
    const existing = (
      await db
        .select()
        .from(scheduleMembers)
        .where(
          and(
            eq(scheduleMembers.schedule_id, schedule.id),
            eq(scheduleMembers.user_id, user.id)
          )
        )
    )[0];
    if (!existing) {
      await db.insert(scheduleMembers).values({ schedule_id: schedule.id, user_id: user.id });
      console.log(`Added ${user.name} to schedule`);
    }

    // Ensure shift_users rows exist for all shifts
    for (const shift of scheduleShifts) {
      await db
        .insert(shiftUsers)
        .values({ shift_id: shift.id, user_id: user.id, state: 'available' })
        .onConflictDoNothing();
    }
  }

  // ─── Shift State Overrides ───────────────────────────────────────────────────
  if (scheduleShifts.length >= 4) {
    // Bob in_shift for shifts[0] and shifts[1]
    for (const shift of [scheduleShifts[0], scheduleShifts[1]]) {
      await db
        .insert(shiftUsers)
        .values({ shift_id: shift.id, user_id: bob.id, state: 'in_shift' })
        .onConflictDoUpdate({
          target: [shiftUsers.shift_id, shiftUsers.user_id],
          set: { state: 'in_shift' },
        });
    }
    // Carol in_shift for shifts[2]
    await db
      .insert(shiftUsers)
      .values({ shift_id: scheduleShifts[2].id, user_id: carol.id, state: 'in_shift' })
      .onConflictDoUpdate({
        target: [shiftUsers.shift_id, shiftUsers.user_id],
        set: { state: 'in_shift' },
      });
    console.log('Set shift state overrides');

    // ─── Home Requests ────────────────────────────────────────────────────────
    // Carol: pending request for shifts[3]
    const carolPendingKey = `${scheduleShifts[3].id}:${carol.id}`;
    const carolExisting = (
      await db
        .select()
        .from(homeRequestShifts)
        .where(
          and(
            eq(homeRequestShifts.shift_id, scheduleShifts[3].id),
            eq(homeRequestShifts.user_id, carol.id)
          )
        )
    )[0];
    if (!carolExisting) {
      const carolRequestId = uuidv4();
      await db.insert(homeRequestShifts).values({
        request_id: carolRequestId,
        user_id: carol.id,
        schedule_id: schedule.id,
        shift_id: scheduleShifts[3].id,
        decision: 'pending',
      });
      console.log("Created Carol's pending home request");
    }

    // Dave: approved request for shifts[0], state updated to home
    const daveExisting = (
      await db
        .select()
        .from(homeRequestShifts)
        .where(
          and(
            eq(homeRequestShifts.shift_id, scheduleShifts[0].id),
            eq(homeRequestShifts.user_id, dave.id)
          )
        )
    )[0];
    if (!daveExisting) {
      const daveRequestId = uuidv4();
      await db.insert(homeRequestShifts).values({
        request_id: daveRequestId,
        user_id: dave.id,
        schedule_id: schedule.id,
        shift_id: scheduleShifts[0].id,
        decision: 'approved',
      });
      // Update shift state to home
      await db
        .insert(shiftUsers)
        .values({ shift_id: scheduleShifts[0].id, user_id: dave.id, state: 'home' })
        .onConflictDoUpdate({
          target: [shiftUsers.shift_id, shiftUsers.user_id],
          set: { state: 'home' },
        });
      console.log("Created Dave's approved home request");
    }
  }

  // ─── Notifications ────────────────────────────────────────────────────────────
  const existingNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.user_id, bob.id));

  if (existingNotifications.length === 0) {
    await db.insert(notifications).values([
      {
        user_id: bob.id,
        type: 'assigned_in_shift',
        payload_json: { schedule_id: schedule.id, shift_id: scheduleShifts[0]?.id, message: 'You were assigned to a shift' },
        is_read: false,
      },
      {
        user_id: bob.id,
        type: 'assigned_in_shift',
        payload_json: { schedule_id: schedule.id, shift_id: scheduleShifts[1]?.id, message: 'You were assigned to another shift' },
        is_read: false,
      },
      {
        user_id: bob.id,
        type: 'state_changed_home',
        payload_json: { message: 'Your shift state was updated' },
        is_read: true,
      },
    ]);
    console.log("Created Bob's notifications");
  }

  // ─── Audit Logs ───────────────────────────────────────────────────────────────
  const existingLogs = await db.select().from(auditLogs);
  if (existingLogs.length === 0) {
    await db.insert(auditLogs).values([
      {
        actor_user_id: alice.id,
        affected_user_id: bob.id,
        schedule_id: schedule.id,
        shift_id: scheduleShifts[0]?.id ?? null,
        action: 'state_set',
        old_value_json: { state: 'available' },
        new_value_json: { state: 'in_shift' },
      },
      {
        actor_user_id: alice.id,
        affected_user_id: carol.id,
        schedule_id: schedule.id,
        shift_id: scheduleShifts[2]?.id ?? null,
        action: 'state_set',
        old_value_json: { state: 'available' },
        new_value_json: { state: 'in_shift' },
      },
      {
        actor_user_id: alice.id,
        affected_user_id: dave.id,
        schedule_id: schedule.id,
        shift_id: scheduleShifts[0]?.id ?? null,
        action: 'home_approved',
        old_value_json: { decision: 'pending', state: 'available' },
        new_value_json: { decision: 'approved', state: 'home' },
      },
      {
        actor_user_id: alice.id,
        action: 'member_added',
        affected_user_id: dave.id,
        schedule_id: schedule.id,
        shift_id: null,
        new_value_json: { user_id: dave.id, note: 'Fill-in from Beta Team' },
      },
      {
        actor_user_id: carol.id,
        affected_user_id: carol.id,
        schedule_id: schedule.id,
        shift_id: scheduleShifts[3]?.id ?? null,
        action: 'home_request_created',
        new_value_json: { shift_ids: [scheduleShifts[3]?.id] },
      },
    ]);
    console.log('Created audit log entries');
  }

  console.log('\nSeed complete! Users:');
  console.log('  alice@example.com (admin, Alpha Team)');
  console.log('  bob@example.com (Alpha Team)');
  console.log('  carol@example.com (Alpha Team)');
  console.log('  dave@example.com (Beta Team - fill-in)');
  console.log('  eva@example.com (Beta Team)');
  console.log('\nNote: To log in as admin, set ADMIN_EMAILS=alice@example.com in .env');

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
