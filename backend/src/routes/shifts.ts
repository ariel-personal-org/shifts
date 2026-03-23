import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { shiftUsers, shifts, scheduleMembers, homeRequestShifts } from '../db/schema';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { createNotification, createAuditLog } from '../utils/notify';

const router = Router();

// PUT /api/schedules/:scheduleId/shifts/:shiftId/users/:userId/state
router.put(
  '/:scheduleId/shifts/:shiftId/users/:userId/state',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const scheduleId = parseInt(req.params.scheduleId);
      const shiftId = parseInt(req.params.shiftId);
      const userId = parseInt(req.params.userId);

      const schema = z.object({
        state: z.enum(['in_shift', 'available', 'home']),
      });
      const { state } = schema.parse(req.body);

      // Verify shift belongs to schedule
      const [shift] = await db
        .select()
        .from(shifts)
        .where(and(eq(shifts.id, shiftId), eq(shifts.schedule_id, scheduleId)));
      if (!shift) return res.status(404).json({ error: 'Shift not found in this schedule' });

      // Verify user is a member
      const [membership] = await db
        .select()
        .from(scheduleMembers)
        .where(and(eq(scheduleMembers.schedule_id, scheduleId), eq(scheduleMembers.user_id, userId)));
      if (!membership) return res.status(400).json({ error: 'User is not a member of this schedule' });

      // Check for pending home request
      const [pendingRequest] = await db
        .select()
        .from(homeRequestShifts)
        .where(
          and(
            eq(homeRequestShifts.shift_id, shiftId),
            eq(homeRequestShifts.user_id, userId),
            eq(homeRequestShifts.decision, 'pending')
          )
        );

      const hasPendingRequest = !!pendingRequest;

      // Get current state
      const [currentRow] = await db
        .select()
        .from(shiftUsers)
        .where(and(eq(shiftUsers.shift_id, shiftId), eq(shiftUsers.user_id, userId)));
      const oldState = currentRow?.state ?? 'available';

      // Upsert state
      await db
        .insert(shiftUsers)
        .values({ shift_id: shiftId, user_id: userId, state })
        .onConflictDoUpdate({
          target: [shiftUsers.shift_id, shiftUsers.user_id],
          set: { state },
        });

      // Audit log
      const auditNote = hasPendingRequest && state === 'in_shift'
        ? 'admin_assigned_in_shift_with_pending_home_request'
        : 'state_set';

      await createAuditLog({
        actor_user_id: req.user!.id,
        affected_user_id: userId,
        schedule_id: scheduleId,
        shift_id: shiftId,
        action: auditNote,
        old_value: { state: oldState },
        new_value: { state },
      });

      // Notifications
      if (oldState !== state) {
        const notifType =
          state === 'in_shift'
            ? 'assigned_in_shift'
            : state === 'home'
            ? 'state_changed_home'
            : 'removed_from_shift';

        await createNotification({
          user_id: userId,
          type: notifType,
          payload: { schedule_id: scheduleId, shift_id: shiftId, old_state: oldState, new_state: state },
        });
      }

      return res.json({
        ok: true,
        state,
        warned_pending_request: hasPendingRequest && state === 'in_shift',
      });
    } catch (err: any) {
      if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
