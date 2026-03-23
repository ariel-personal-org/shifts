import { Router } from 'express';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { schedules, shifts, scheduleMembers, shiftUsers, users, teams, homeRequestShifts } from '../db/schema';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { generateShifts } from '../utils/shiftGenerator';
import { createAuditLog } from '../utils/notify';

const router = Router();

// GET /api/schedules
router.get('/', requireAuth, async (_req, res) => {
  try {
    const all = await db
      .select({
        schedule: schedules,
        primaryTeam: teams,
      })
      .from(schedules)
      .leftJoin(teams, eq(schedules.primary_team_id, teams.id))
      .orderBy(schedules.start_date);
    return res.json(all.map((r) => ({ ...r.schedule, primary_team: r.primaryTeam })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/schedules
router.post('/', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      cycle_start_time: z.string().regex(/^\d{2}:\d{2}$/),
      shift_duration_hours: z.number().int().positive(),
      capacity: z.number().int().positive(),
      primary_team_id: z.number().int().positive(),
      timezone: z.string().min(1).default('UTC'),
    });
    const data = schema.parse(req.body);

    const [schedule] = await db.insert(schedules).values(data).returning();

    // Generate shifts
    const generated = generateShifts(
      data.start_date,
      data.end_date,
      data.cycle_start_time,
      data.shift_duration_hours,
      data.timezone
    );

    if (generated.length > 0) {
      await db.insert(shifts).values(
        generated.map((s) => ({
          schedule_id: schedule.id,
          start_datetime: s.start_datetime,
          end_datetime: s.end_datetime,
          index: s.index,
        }))
      );
    }

    await createAuditLog({
      actor_user_id: req.user!.id,
      schedule_id: schedule.id,
      action: 'schedule_created',
      new_value: { name: schedule.name, shift_count: generated.length },
    });

    const scheduleShifts = await db
      .select()
      .from(shifts)
      .where(eq(shifts.schedule_id, schedule.id))
      .orderBy(shifts.index);

    return res.status(201).json({ ...schedule, shifts: scheduleShifts });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/schedules/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db
      .select({ schedule: schedules, primaryTeam: teams })
      .from(schedules)
      .leftJoin(teams, eq(schedules.primary_team_id, teams.id))
      .where(eq(schedules.id, id));
    if (!row) return res.status(404).json({ error: 'Schedule not found' });
    return res.json({ ...row.schedule, primary_team: row.primaryTeam });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/schedules/:id
router.put('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const schema = z.object({
      name: z.string().min(1).optional(),
      capacity: z.number().int().positive().optional(),
    });
    const updates = schema.parse(req.body);

    const [existing] = await db.select().from(schedules).where(eq(schedules.id, id));
    if (!existing) return res.status(404).json({ error: 'Schedule not found' });

    const [updated] = await db.update(schedules).set(updates).where(eq(schedules.id, id)).returning();
    await createAuditLog({
      actor_user_id: req.user!.id,
      schedule_id: id,
      action: 'schedule_updated',
      old_value: { name: existing.name, capacity: existing.capacity },
      new_value: updates,
    });
    return res.json(updated);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/schedules/:id/shifts
router.get('/:id/shifts', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await db
      .select()
      .from(shifts)
      .where(eq(shifts.schedule_id, id))
      .orderBy(shifts.index);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/schedules/:id/members
router.get('/:id/members', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await db
      .select({ user: users, team: teams })
      .from(scheduleMembers)
      .innerJoin(users, eq(scheduleMembers.user_id, users.id))
      .leftJoin(teams, eq(users.team_id, teams.id))
      .where(eq(scheduleMembers.schedule_id, id));
    return res.json(result.map((r) => ({ ...r.user, team: r.team })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/schedules/:id/members
router.post('/:id/members', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const schema = z.object({ userId: z.number().int().positive() });
    const { userId } = schema.parse(req.body);

    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, scheduleId));
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check already a member
    const [existing] = await db
      .select()
      .from(scheduleMembers)
      .where(and(eq(scheduleMembers.schedule_id, scheduleId), eq(scheduleMembers.user_id, userId)));
    if (existing) return res.status(409).json({ error: 'User is already a member' });

    await db.insert(scheduleMembers).values({ schedule_id: scheduleId, user_id: userId });

    // Create shift_users rows for all shifts
    const scheduleShifts = await db
      .select()
      .from(shifts)
      .where(eq(shifts.schedule_id, scheduleId));

    if (scheduleShifts.length > 0) {
      await db.insert(shiftUsers).values(
        scheduleShifts.map((s) => ({
          shift_id: s.id,
          user_id: userId,
          state: 'available' as const,
        }))
      ).onConflictDoNothing();
    }

    await createAuditLog({
      actor_user_id: req.user!.id,
      affected_user_id: userId,
      schedule_id: scheduleId,
      action: 'member_added',
      new_value: { user_id: userId, schedule_id: scheduleId },
    });
    return res.status(201).json({ ok: true });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/schedules/:id/members/:userId
router.delete('/:id/members/:userId', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);

    const scheduleShifts = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(eq(shifts.schedule_id, scheduleId));

    const shiftIds = scheduleShifts.map((s) => s.id);
    if (shiftIds.length > 0) {
      await db
        .delete(shiftUsers)
        .where(and(inArray(shiftUsers.shift_id, shiftIds), eq(shiftUsers.user_id, userId)));
    }

    await db
      .delete(scheduleMembers)
      .where(and(eq(scheduleMembers.schedule_id, scheduleId), eq(scheduleMembers.user_id, userId)));

    await createAuditLog({
      actor_user_id: req.user!.id,
      affected_user_id: userId,
      schedule_id: scheduleId,
      action: 'member_removed',
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/schedules/:id/grid
router.get('/:id/grid', requireAuth, async (req: AuthRequest, res) => {
  try {
    const scheduleId = parseInt(req.params.id);

    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, scheduleId));
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    const scheduleShifts = await db
      .select()
      .from(shifts)
      .where(eq(shifts.schedule_id, scheduleId))
      .orderBy(shifts.index);

    const shiftIds = scheduleShifts.map((s) => s.id);

    // Get members with their teams
    const memberRows = await db
      .select({ user: users, team: teams })
      .from(scheduleMembers)
      .innerJoin(users, eq(scheduleMembers.user_id, users.id))
      .leftJoin(teams, eq(users.team_id, teams.id))
      .where(eq(scheduleMembers.schedule_id, scheduleId));

    // Get all shift_users states
    const allStates =
      shiftIds.length > 0
        ? await db
            .select()
            .from(shiftUsers)
            .where(inArray(shiftUsers.shift_id, shiftIds))
        : [];

    // Get pending home request shifts
    const pendingRequests =
      shiftIds.length > 0
        ? await db
            .select()
            .from(homeRequestShifts)
            .where(
              and(
                inArray(homeRequestShifts.shift_id, shiftIds),
                eq(homeRequestShifts.decision, 'pending')
              )
            )
        : [];

    const pendingSet = new Set(pendingRequests.map((p) => `${p.shift_id}:${p.user_id}`));

    // Sort: primary team first, then fill-ins, alphabetically within each group
    const sorted = memberRows.sort((a, b) => {
      const aIsFillIn = !a.user.team_id || a.user.team_id !== schedule.primary_team_id;
      const bIsFillIn = !b.user.team_id || b.user.team_id !== schedule.primary_team_id;
      if (aIsFillIn !== bIsFillIn) return aIsFillIn ? 1 : -1;
      return a.user.name.localeCompare(b.user.name);
    });

    // Build state map
    const stateMap = new Map<string, string>();
    for (const s of allStates) {
      stateMap.set(`${s.shift_id}:${s.user_id}`, s.state);
    }

    // Compute shift stats
    const shiftStats = scheduleShifts.map((shift) => {
      const inShiftCount = allStates.filter(
        (s) => s.shift_id === shift.id && s.state === 'in_shift'
      ).length;
      return {
        shift_id: shift.id,
        in_shift_count: inShiftCount,
        capacity: schedule.capacity,
      };
    });

    const members = sorted.map((row) => ({
      user: row.user,
      team: row.team,
      is_fill_in: !row.user.team_id || row.user.team_id !== schedule.primary_team_id,
      states: scheduleShifts.map((shift) => ({
        shift_id: shift.id,
        state: (stateMap.get(`${shift.id}:${row.user.id}`) ?? 'available') as 'in_shift' | 'available' | 'home',
        has_pending_request: pendingSet.has(`${shift.id}:${row.user.id}`),
      })),
    }));

    return res.json({ schedule, shifts: scheduleShifts, members, shift_stats: shiftStats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
