import { Router } from 'express';
import { eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/notify';
import { generateVirtualEmail, validateUpgrade } from '../utils/virtualUsers';

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

// POST /api/users — create virtual user
router.post('/', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ name: z.string().min(1).max(255) });
    const { name } = schema.parse(req.body);

    const email = generateVirtualEmail();
    const [created] = await db
      .insert(users)
      .values({ name, email, is_virtual: true })
      .returning();

    await createAuditLog({
      actor_user_id: req.user!.id,
      affected_user_id: created.id,
      action: 'virtual_user_created',
      new_value: { name, email },
    });

    return res.status(201).json(created);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID' });
    const schema = z.object({
      team_id: z.number().int().positive().nullable().optional(),
      is_admin: z.boolean().optional(),
      name: z.string().min(1).max(255).optional(),
      email: z.string().email().optional(),
      is_virtual: z.literal(false).optional(),
    });
    const updates = schema.parse(req.body);

    const [existing] = await db.select().from(users).where(eq(users.id, id));
    if (!existing) return res.status(404).json({ error: 'User not found' });

    // Detect upgrade: virtual → real (requires explicit is_virtual: false signal)
    const isUpgrade = existing.is_virtual && updates.is_virtual === false;

    const validationError = validateUpgrade({
      existingIsVirtual: existing.is_virtual,
      isUpgrade,
      email: updates.email,
      teamId: updates.team_id,
    });
    if (validationError === 'email_change_not_allowed') {
      return res.status(400).json({ error: 'Cannot change email of a real user' });
    }
    if (validationError === 'email_required') {
      return res.status(400).json({ error: 'email is required when upgrading a virtual user' });
    }
    if (validationError === 'team_required') {
      return res.status(400).json({ error: 'team_id is required when upgrading a virtual user' });
    }

    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.team_id !== undefined) dbUpdates.team_id = updates.team_id;
    if (updates.is_admin !== undefined) dbUpdates.is_admin = updates.is_admin;
    if (isUpgrade) {
      dbUpdates.email = updates.email;
      dbUpdates.is_virtual = false;
    }

    const [updated] = await db
      .update(users)
      .set(dbUpdates)
      .where(eq(users.id, id))
      .returning();

    await createAuditLog({
      actor_user_id: req.user!.id,
      affected_user_id: id,
      action: isUpgrade ? 'virtual_user_upgraded' : 'user_updated',
      old_value: { name: existing.name, email: existing.email, team_id: existing.team_id, is_admin: existing.is_admin, is_virtual: existing.is_virtual },
      new_value: dbUpdates,
    });

    return res.json(updated);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id — virtual users only
router.delete('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID' });

    const [existing] = await db.select().from(users).where(eq(users.id, id));
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (!existing.is_virtual) {
      return res.status(400).json({ error: 'Only virtual users can be deleted' });
    }

    await db.delete(users).where(eq(users.id, id));

    await createAuditLog({
      actor_user_id: req.user!.id,
      affected_user_id: id,
      action: 'virtual_user_deleted',
      old_value: { name: existing.name, email: existing.email },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
