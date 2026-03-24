import { Router } from 'express';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import {
  homeRequestShifts,
  shiftUsers,
  shifts,
  scheduleMembers,
  schedules,
  users,
} from '../db/schema';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { createNotification, createAuditLog } from '../utils/notify';

const router = Router();

function computeRequestStatus(decisions: string[]): string {
  if (decisions.length === 0) return 'pending';
  if (decisions.every((d) => d === 'approved')) return 'approved';
  if (decisions.every((d) => d === 'rejected')) return 'rejected';
  if (decisions.every((d) => d === 'pending')) return 'pending';
  return 'partial';
}

// GET /api/home-requests
// Admin: all requests; User: own requests
// Query params: ?schedule_id, ?user_id (admin only), ?decision, ?request_id
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const scheduleId = req.query.schedule_id ? parseInt(req.query.schedule_id as string) : undefined;
    const requestId = req.query.request_id as string | undefined;
    const decision = req.query.decision as string | undefined;

    const conditions = [];
    // Non-admins can only see their own requests
    if (!req.user!.is_admin) {
      conditions.push(eq(homeRequestShifts.user_id, req.user!.id));
    } else if (req.query.user_id) {
      conditions.push(eq(homeRequestShifts.user_id, parseInt(req.query.user_id as string)));
    }
    if (scheduleId) conditions.push(eq(homeRequestShifts.schedule_id, scheduleId));
    if (requestId) conditions.push(eq(homeRequestShifts.request_id, requestId));
    if (decision) conditions.push(eq(homeRequestShifts.decision, decision));

    const rows = await db
      .select({
        hrs: homeRequestShifts,
        shift: shifts,
        schedule_timezone: schedules.timezone,
      })
      .from(homeRequestShifts)
      .innerJoin(shifts, eq(homeRequestShifts.shift_id, shifts.id))
      .innerJoin(schedules, eq(homeRequestShifts.schedule_id, schedules.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(homeRequestShifts.created_at);

    // Group by request_id
    const grouped = new Map<string, { request_id: string; user_id: number; schedule_id: number; schedule_timezone: string; created_at: Date; shifts: any[]; status: string }>();
    for (const row of rows) {
      const rid = row.hrs.request_id;
      if (!grouped.has(rid)) {
        grouped.set(rid, {
          request_id: rid,
          user_id: row.hrs.user_id,
          schedule_id: row.hrs.schedule_id,
          schedule_timezone: row.schedule_timezone,
          created_at: row.hrs.created_at,
          shifts: [],
          status: 'pending',
        });
      }
      grouped.get(rid)!.shifts.push({
        id: row.hrs.id,
        shift_id: row.hrs.shift_id,
        decision: row.hrs.decision,
        shift: row.shift,
      });
    }

    const result = Array.from(grouped.values()).map((g) => ({
      ...g,
      status: computeRequestStatus(g.shifts.map((s) => s.decision)),
    }));

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/home-requests
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      schedule_id: z.number().int().positive(),
      shift_ids: z.array(z.number().int().positive()).min(1),
    });
    const { schedule_id, shift_ids } = schema.parse(req.body);
    const userId = req.user!.id;

    // Verify schedule exists
    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, schedule_id));
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    // Verify user is a member
    const [membership] = await db
      .select()
      .from(scheduleMembers)
      .where(and(eq(scheduleMembers.schedule_id, schedule_id), eq(scheduleMembers.user_id, userId)));
    if (!membership) return res.status(403).json({ error: 'You are not a member of this schedule' });

    // Check for existing pending requests for any of these shifts
    const existing = await db
      .select()
      .from(homeRequestShifts)
      .where(
        and(
          eq(homeRequestShifts.user_id, userId),
          inArray(homeRequestShifts.shift_id, shift_ids),
          eq(homeRequestShifts.decision, 'pending')
        )
      );
    if (existing.length > 0) {
      return res.status(409).json({
        error: 'You already have a pending request for one or more of these shifts',
        conflicting_shift_ids: existing.map((e) => e.shift_id),
      });
    }

    const requestId = uuidv4();
    await db.insert(homeRequestShifts).values(
      shift_ids.map((shiftId) => ({
        request_id: requestId,
        user_id: userId,
        schedule_id,
        shift_id: shiftId,
        decision: 'pending' as const,
      }))
    );

    await createAuditLog({
      actor_user_id: userId,
      affected_user_id: userId,
      schedule_id,
      action: 'home_request_created',
      new_value: { request_id: requestId, shift_ids },
    });

    return res.status(201).json({ request_id: requestId, shift_ids, status: 'pending' });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/home-requests/:requestId
router.get('/:requestId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const requestId = req.params.requestId;
    const rows = await db
      .select({ hrs: homeRequestShifts, shift: shifts })
      .from(homeRequestShifts)
      .innerJoin(shifts, eq(homeRequestShifts.shift_id, shifts.id))
      .where(eq(homeRequestShifts.request_id, requestId));

    if (rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    // Non-admin can only view own
    if (!req.user!.is_admin && rows[0].hrs.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = {
      request_id: requestId,
      user_id: rows[0].hrs.user_id,
      schedule_id: rows[0].hrs.schedule_id,
      created_at: rows[0].hrs.created_at,
      status: computeRequestStatus(rows.map((r) => r.hrs.decision)),
      shifts: rows.map((r) => ({
        id: r.hrs.id,
        shift_id: r.hrs.shift_id,
        decision: r.hrs.decision,
        shift: r.shift,
      })),
    };
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/home-requests/:requestId/decisions  (admin)
router.put('/:requestId/decisions', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const requestId = req.params.requestId;
    const schema = z.object({
      decisions: z.array(
        z.object({
          shift_id: z.number().int().positive(),
          decision: z.enum(['approved', 'rejected']),
        })
      ).min(1),
    });
    const { decisions } = schema.parse(req.body);

    // Verify request exists
    const existingRows = await db
      .select()
      .from(homeRequestShifts)
      .where(eq(homeRequestShifts.request_id, requestId));
    if (existingRows.length === 0) return res.status(404).json({ error: 'Request not found' });

    const targetUserId = existingRows[0].user_id;
    const scheduleId = existingRows[0].schedule_id;

    for (const { shift_id, decision } of decisions) {
      const [row] = existingRows.filter((r) => r.shift_id === shift_id);
      if (!row) continue;

      const oldDecision = row.decision;
      await db
        .update(homeRequestShifts)
        .set({ decision })
        .where(and(eq(homeRequestShifts.request_id, requestId), eq(homeRequestShifts.shift_id, shift_id)));

      if (decision === 'approved') {
        // Get current shift state
        const [currentState] = await db
          .select()
          .from(shiftUsers)
          .where(and(eq(shiftUsers.shift_id, shift_id), eq(shiftUsers.user_id, targetUserId)));

        const oldState = currentState?.state ?? 'available';

        // Update shift_users state to home
        await db
          .insert(shiftUsers)
          .values({ shift_id, user_id: targetUserId, state: 'home' })
          .onConflictDoUpdate({
            target: [shiftUsers.shift_id, shiftUsers.user_id],
            set: { state: 'home' },
          });

        await createAuditLog({
          actor_user_id: req.user!.id,
          affected_user_id: targetUserId,
          schedule_id: scheduleId,
          shift_id,
          action: oldState === 'in_shift' ? 'home_approved_override_in_shift' : 'home_approved',
          old_value: { decision: oldDecision, state: oldState },
          new_value: { decision: 'approved', state: 'home' },
        });
      } else {
        await createAuditLog({
          actor_user_id: req.user!.id,
          affected_user_id: targetUserId,
          schedule_id: scheduleId,
          shift_id,
          action: 'home_rejected',
          old_value: { decision: oldDecision },
          new_value: { decision: 'rejected' },
        });
      }
    }

    // Notify user of outcome
    const allRows = await db
      .select()
      .from(homeRequestShifts)
      .where(eq(homeRequestShifts.request_id, requestId));
    const newStatus = computeRequestStatus(allRows.map((r) => r.decision));

    const notifType =
      newStatus === 'approved'
        ? 'request_approved'
        : newStatus === 'rejected'
        ? 'request_rejected'
        : 'request_partial';

    await createNotification({
      user_id: targetUserId,
      type: notifType,
      payload: { request_id: requestId, schedule_id: scheduleId, status: newStatus },
    });

    return res.json({ ok: true, status: newStatus });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/home-requests/:requestId  (cancel pending shifts)
router.delete('/:requestId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const requestId = req.params.requestId;

    const rows = await db
      .select()
      .from(homeRequestShifts)
      .where(eq(homeRequestShifts.request_id, requestId));

    if (rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    // Only owner or admin can cancel
    if (!req.user!.is_admin && rows[0].user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const pendingRows = rows.filter((r) => r.decision === 'pending');
    if (pendingRows.length === 0) {
      return res.status(400).json({ error: 'No pending shifts to cancel' });
    }

    // Delete only the pending rows
    await db
      .delete(homeRequestShifts)
      .where(
        and(
          eq(homeRequestShifts.request_id, requestId),
          eq(homeRequestShifts.decision, 'pending')
        )
      );

    await createAuditLog({
      actor_user_id: req.user!.id,
      affected_user_id: rows[0].user_id,
      schedule_id: rows[0].schedule_id,
      action: 'home_request_cancelled',
      new_value: { request_id: requestId, cancelled_shift_ids: pendingRows.map((r) => r.shift_id) },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
