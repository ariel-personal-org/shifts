import { Router } from 'express';
import { eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/notify';

const router = Router();

// GET /api/users?q=search
router.get('/', requireAuth, async (req, res) => {
  try {
    const q = req.query.q as string | undefined;
    let result;
    if (q) {
      result = await db
        .select()
        .from(users)
        .where(or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)))
        .orderBy(users.name);
    } else {
      result = await db.select().from(users).orderBy(users.name);
    }
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const schema = z.object({
      team_id: z.number().int().positive().nullable().optional(),
      is_admin: z.boolean().optional(),
      name: z.string().min(1).optional(),
    });
    const updates = schema.parse(req.body);

    const [existing] = await db.select().from(users).where(eq(users.id, id));
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();

    await createAuditLog({
      actor_user_id: req.user!.id,
      affected_user_id: id,
      action: 'user_updated',
      old_value: { team_id: existing.team_id, is_admin: existing.is_admin },
      new_value: updates,
    });
    return res.json(updated);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
