import { Router } from 'express';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs } from '../db/schema';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/audit-logs
// Admin: all logs (with filters); User: only logs affecting them
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const conditions: any[] = [];

    if (!req.user!.is_admin) {
      // Users only see logs affecting them
      conditions.push(eq(auditLogs.affected_user_id, req.user!.id));
    } else {
      // Admin filters
      if (req.query.user_id) {
        conditions.push(eq(auditLogs.affected_user_id, parseInt(req.query.user_id as string)));
      }
      if (req.query.actor_id) {
        conditions.push(eq(auditLogs.actor_user_id, parseInt(req.query.actor_id as string)));
      }
      if (req.query.schedule_id) {
        conditions.push(eq(auditLogs.schedule_id, parseInt(req.query.schedule_id as string)));
      }
      if (req.query.action) {
        conditions.push(eq(auditLogs.action, req.query.action as string));
      }
    }

    if (req.query.from_date) {
      conditions.push(gte(auditLogs.created_at, new Date(req.query.from_date as string)));
    }
    if (req.query.to_date) {
      conditions.push(lte(auditLogs.created_at, new Date(req.query.to_date as string)));
    }

    const result = await db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.created_at))
      .limit(500);

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
