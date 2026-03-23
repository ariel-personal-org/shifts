import { Router } from 'express';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  schedules,
  shifts,
  scheduleMembers,
  shiftUsers,
  homeRequestShifts,
} from '../db/schema';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { createNotification, createAuditLog } from '../utils/notify';
import { shiftsOverlap } from '../utils/shiftGenerator';

const router = Router();

// POST /api/schedules/:id/auto-fill
router.post('/:id/auto-fill', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const actorId = req.user!.id;

    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, scheduleId));
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    // Load all shifts in chronological order
    const allShifts = await db
      .select()
      .from(shifts)
      .where(eq(shifts.schedule_id, scheduleId))
      .orderBy(shifts.index);

    const shiftIds = allShifts.map((s) => s.id);
    if (shiftIds.length === 0) return res.json({ assignments_made: 0, shifts_filled: [], shifts_still_under: [] });

    // Load all members
    const memberRows = await db
      .select({ user_id: scheduleMembers.user_id })
      .from(scheduleMembers)
      .where(eq(scheduleMembers.schedule_id, scheduleId));
    const memberIds = memberRows.map((m) => m.user_id);

    // Load all shift_users states
    const allStates = await db
      .select()
      .from(shiftUsers)
      .where(inArray(shiftUsers.shift_id, shiftIds));

    // Load pending home requests
    const pendingRequests = await db
      .select()
      .from(homeRequestShifts)
      .where(
        and(
          inArray(homeRequestShifts.shift_id, shiftIds),
          eq(homeRequestShifts.decision, 'pending')
        )
      );
    const pendingSet = new Set(pendingRequests.map((p) => `${p.shift_id}:${p.user_id}`));

    // Build state lookup
    const stateMap = new Map<string, string>();
    for (const s of allStates) {
      stateMap.set(`${s.shift_id}:${s.user_id}`, s.state);
    }

    const assignments: Array<{ shift_id: number; user_id: number }> = [];
    // Track this-run assignments for overlap detection: user_id → shift objects
    const thisRunAssignments = new Map<number, typeof allShifts>();

    for (const shift of allShifts) {
      // Count current in_shift
      let inShiftCount = memberIds.filter(
        (uid) => stateMap.get(`${shift.id}:${uid}`) === 'in_shift'
      ).length;

      if (inShiftCount >= schedule.capacity) continue;

      // Find eligible users
      for (const userId of memberIds) {
        if (inShiftCount >= schedule.capacity) break;

        const currentState = stateMap.get(`${shift.id}:${userId}`) ?? 'available';
        if (currentState !== 'available') continue;

        // Check overlap with existing in_shift + this-run assignments
        const userThisRunShifts = thisRunAssignments.get(userId) ?? [];
        const hasOverlap = userThisRunShifts.some((assignedShift) =>
          shiftsOverlap(shift, assignedShift)
        );
        if (hasOverlap) continue;

        // Also check existing in_shift for overlapping shifts
        const userInShiftIds = allStates
          .filter((s) => s.user_id === userId && s.state === 'in_shift')
          .map((s) => s.shift_id);
        const overlappingExisting = allShifts.filter(
          (s) => userInShiftIds.includes(s.id) && shiftsOverlap(s, shift)
        );
        if (overlappingExisting.length > 0) continue;

        // Assign!
        stateMap.set(`${shift.id}:${userId}`, 'in_shift');
        inShiftCount++;
        assignments.push({ shift_id: shift.id, user_id: userId });
        thisRunAssignments.set(userId, [...userThisRunShifts, shift]);

        const hasPending = pendingSet.has(`${shift.id}:${userId}`);

        // Persist
        await db
          .insert(shiftUsers)
          .values({ shift_id: shift.id, user_id: userId, state: 'in_shift' })
          .onConflictDoUpdate({
            target: [shiftUsers.shift_id, shiftUsers.user_id],
            set: { state: 'in_shift' },
          });

        await createNotification({
          user_id: userId,
          type: 'assigned_in_shift',
          payload: {
            schedule_id: scheduleId,
            shift_id: shift.id,
            auto_fill: true,
          },
        });

        await createAuditLog({
          actor_user_id: actorId,
          affected_user_id: userId,
          schedule_id: scheduleId,
          shift_id: shift.id,
          action: hasPending ? 'auto_fill_assigned_with_pending_request' : 'auto_fill_assigned',
          old_value: { state: 'available' },
          new_value: { state: 'in_shift', auto_fill: true },
        });
      }
    }

    // Compute summary
    const shiftsFilledIds = new Set(assignments.map((a) => a.shift_id));
    const shiftsStillUnder = allShifts
      .filter((shift) => {
        const count = memberIds.filter(
          (uid) => stateMap.get(`${shift.id}:${uid}`) === 'in_shift'
        ).length;
        return count < schedule.capacity;
      })
      .map((s) => s.id);

    return res.json({
      assignments_made: assignments.length,
      shifts_filled: Array.from(shiftsFilledIds),
      shifts_still_under: shiftsStillUnder,
      details: assignments,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
