import { Router } from 'express';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { shiftUsers, shifts, scheduleMembers, homeRequestShifts, notifications, auditLogs } from '../db/schema';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { createNotification, createAuditLog } from '../utils/notify';

const router = Router();

// PUT /api/schedules/:scheduleId/bulk-state
router.put(
  '/:scheduleId/bulk-state',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const scheduleId = parseInt(req.params.scheduleId);
      if (isNaN(scheduleId)) return res.status(400).json({ error: 'Invalid scheduleId' });

      const schema = z.object({
        changes: z.array(z.object({
          shiftId: z.number().int().positive(),
          userId: z.number().int().positive(),
          state: z.enum(['in_shift', 'available', 'home']),
        })).min(1).max(500),
      });
      const { changes: rawChanges } = schema.parse(req.body);

      // Deduplicate by (shiftId, userId) — last entry wins
      const deduped = new Map<string, typeof rawChanges[number]>();
      for (const c of rawChanges) {
        deduped.set(`${c.shiftId}:${c.userId}`, c);
      }
      const changes = [...deduped.values()];

      const uniqueShiftIds = [...new Set(changes.map((c) => c.shiftId))];
      const uniqueUserIds = [...new Set(changes.map((c) => c.userId))];

      // Batch validate shifts belong to schedule
      const validShifts = await db
        .select({ id: shifts.id })
        .from(shifts)
        .where(and(inArray(shifts.id, uniqueShiftIds), eq(shifts.schedule_id, scheduleId)));
      const validShiftIds = new Set(validShifts.map((s) => s.id));
      const invalidShiftIds = uniqueShiftIds.filter((id) => !validShiftIds.has(id));
      if (invalidShiftIds.length > 0) {
        return res.status(400).json({ error: `Shifts not in this schedule: ${invalidShiftIds.join(', ')}` });
      }

      // Batch validate memberships
      const validMembers = await db
        .select({ user_id: scheduleMembers.user_id })
        .from(scheduleMembers)
        .where(and(eq(scheduleMembers.schedule_id, scheduleId), inArray(scheduleMembers.user_id, uniqueUserIds)));
      const validUserIds = new Set(validMembers.map((m) => m.user_id));
      const invalidUserIds = uniqueUserIds.filter((id) => !validUserIds.has(id));
      if (invalidUserIds.length > 0) {
        return res.status(400).json({ error: `Users not members of this schedule: ${invalidUserIds.join(', ')}` });
      }

      // Batch load pending home requests
      const pendingRequests = await db
        .select()
        .from(homeRequestShifts)
        .where(and(
          inArray(homeRequestShifts.shift_id, uniqueShiftIds),
          inArray(homeRequestShifts.user_id, uniqueUserIds),
          eq(homeRequestShifts.decision, 'pending')
        ));
      const pendingMap = new Map(pendingRequests.map((r) => [`${r.shift_id}:${r.user_id}`, r]));

      // Batch load current states
      const currentStates = await db
        .select()
        .from(shiftUsers)
        .where(and(
          inArray(shiftUsers.shift_id, uniqueShiftIds),
          inArray(shiftUsers.user_id, uniqueUserIds)
        ));
      const stateMap = new Map(currentStates.map((r) => [`${r.shift_id}:${r.user_id}`, r.state]));

      const actorId = req.user!.id;

      await db.transaction(async (tx) => {
        // Batch upsert: group by target state for efficient multi-row inserts
        const byState = new Map<string, Array<{ shift_id: number; user_id: number }>>();
        for (const c of changes) {
          const group = byState.get(c.state) || [];
          group.push({ shift_id: c.shiftId, user_id: c.userId });
          byState.set(c.state, group);
        }
        for (const [state, rows] of byState) {
          await tx.insert(shiftUsers)
            .values(rows.map((r) => ({ shift_id: r.shift_id, user_id: r.user_id, state })))
            .onConflictDoUpdate({
              target: [shiftUsers.shift_id, shiftUsers.user_id],
              set: { state },
            });
        }

        // Per-change side effects: audit logs, notifications, home request approvals
        // Track request_ids that had approvals — notifications are deferred to after all approvals
        const approvedRequestIds = new Map<string, number>(); // request_id → userId

        for (const c of changes) {
          const key = `${c.shiftId}:${c.userId}`;
          const oldState = stateMap.get(key) ?? 'available';
          const pendingRequest = pendingMap.get(key);
          const hasPendingRequest = !!pendingRequest;

          // Skip no-op changes
          if (oldState === c.state && !hasPendingRequest) continue;

          if (c.state === 'home' && pendingRequest) {
            // Auto-approve pending home request
            await tx.update(homeRequestShifts)
              .set({ decision: 'approved' })
              .where(and(
                eq(homeRequestShifts.shift_id, c.shiftId),
                eq(homeRequestShifts.user_id, c.userId),
                eq(homeRequestShifts.decision, 'pending')
              ));

            await tx.insert(auditLogs).values({
              actor_user_id: actorId,
              affected_user_id: c.userId,
              schedule_id: scheduleId,
              shift_id: c.shiftId,
              action: 'home_approved',
              old_value_json: { decision: 'pending', state: oldState },
              new_value_json: { decision: 'approved', state: 'home' },
            });

            approvedRequestIds.set(pendingRequest.request_id, c.userId);
          } else if (oldState !== c.state) {
            const auditAction = hasPendingRequest && c.state === 'in_shift'
              ? 'admin_assigned_in_shift_with_pending_home_request'
              : 'state_set';

            await tx.insert(auditLogs).values({
              actor_user_id: actorId,
              affected_user_id: c.userId,
              schedule_id: scheduleId,
              shift_id: c.shiftId,
              action: auditAction,
              old_value_json: { state: oldState },
              new_value_json: { state: c.state },
            });
          }

          // State change notification (skip if handled by request approval)
          if (oldState !== c.state && !(c.state === 'home' && pendingRequest)) {
            const notifType = c.state === 'in_shift'
              ? 'assigned_in_shift'
              : c.state === 'home'
              ? 'state_changed_home'
              : 'removed_from_shift';

            await tx.insert(notifications).values({
              user_id: c.userId,
              type: notifType,
              payload_json: { schedule_id: scheduleId, shift_id: c.shiftId, old_state: oldState, new_state: c.state },
              is_read: false,
            });
          }
        }

        // Deferred: compute request status AFTER all approvals are applied
        for (const [requestId, userId] of approvedRequestIds) {
          const allRows = await tx.select().from(homeRequestShifts)
            .where(eq(homeRequestShifts.request_id, requestId));
          const decisions = allRows.map((r) => r.decision);
          const allApproved = decisions.every((d) => d === 'approved');
          const allRejected = decisions.every((d) => d === 'rejected');
          const requestStatus = allApproved ? 'approved' : allRejected ? 'rejected' : decisions.every((d) => d === 'pending') ? 'pending' : 'partial';

          if (requestStatus !== 'pending') {
            const notifType = requestStatus === 'approved' ? 'request_approved' : requestStatus === 'rejected' ? 'request_rejected' : 'request_partial';
            await tx.insert(notifications).values({
              user_id: userId,
              type: notifType,
              payload_json: { request_id: requestId, schedule_id: scheduleId, status: requestStatus },
              is_read: false,
            });
          }
        }
      });

      return res.json({ ok: true, updated: changes.length });
    } catch (err: any) {
      if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

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

      // If setting to 'home' and there's a pending request, approve it
      if (state === 'home' && pendingRequest) {
        await db
          .update(homeRequestShifts)
          .set({ decision: 'approved' })
          .where(
            and(
              eq(homeRequestShifts.shift_id, shiftId),
              eq(homeRequestShifts.user_id, userId),
              eq(homeRequestShifts.decision, 'pending')
            )
          );

        await createAuditLog({
          actor_user_id: req.user!.id,
          affected_user_id: userId,
          schedule_id: scheduleId,
          shift_id: shiftId,
          action: 'home_approved',
          old_value: { decision: 'pending', state: oldState },
          new_value: { decision: 'approved', state: 'home' },
        });

        // Compute overall request status and notify user
        const allRows = await db
          .select()
          .from(homeRequestShifts)
          .where(eq(homeRequestShifts.request_id, pendingRequest.request_id));
        const decisions = allRows.map((r) => r.decision);
        const allApproved = decisions.every((d) => d === 'approved');
        const allRejected = decisions.every((d) => d === 'rejected');
        const requestStatus = allApproved ? 'approved' : allRejected ? 'rejected' : decisions.every((d) => d === 'pending') ? 'pending' : 'partial';

        if (requestStatus !== 'pending') {
          const notifType = requestStatus === 'approved' ? 'request_approved' : requestStatus === 'rejected' ? 'request_rejected' : 'request_partial';
          await createNotification({
            user_id: userId,
            type: notifType,
            payload: { request_id: pendingRequest.request_id, schedule_id: scheduleId, status: requestStatus },
          });
        }
      } else {
        // Standard audit log
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
      }

      // Notifications for state change (skip if already handled by request approval)
      if (oldState !== state && !(state === 'home' && pendingRequest)) {
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
