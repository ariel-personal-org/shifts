import { Router } from 'express';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { teams, users } from '../db/schema';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/notify';

const router = Router();

// GET /api/teams
router.get('/', requireAuth, async (_req, res) => {
  try {
    const all = await db.select().from(teams).orderBy(teams.name);
    return res.json(all);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/teams
router.post('/', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ name: z.string().min(1).max(255) });
    const { name } = schema.parse(req.body);

    const [team] = await db.insert(teams).values({ name }).returning();
    await createAuditLog({
      actor_user_id: req.user!.id,
      action: 'team_created',
      new_value: { team_id: team.id, name: team.name },
    });
    return res.status(201).json(team);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err.code === '23505') return res.status(409).json({ error: 'Team name already exists' });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/teams/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const members = await db.select().from(users).where(eq(users.team_id, id));
    return res.json({ ...team, members });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/teams/:id
router.put('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const schema = z.object({ name: z.string().min(1).max(255) });
    const { name } = schema.parse(req.body);

    const [existing] = await db.select().from(teams).where(eq(teams.id, id));
    if (!existing) return res.status(404).json({ error: 'Team not found' });

    const [updated] = await db.update(teams).set({ name }).where(eq(teams.id, id)).returning();
    await createAuditLog({
      actor_user_id: req.user!.id,
      action: 'team_updated',
      old_value: { name: existing.name },
      new_value: { name },
    });
    return res.json(updated);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err.code === '23505') return res.status(409).json({ error: 'Team name already exists' });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/teams/:id
router.delete('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(teams).where(eq(teams.id, id));
    if (!existing) return res.status(404).json({ error: 'Team not found' });

    await db.delete(teams).where(eq(teams.id, id));
    await createAuditLog({
      actor_user_id: req.user!.id,
      action: 'team_deleted',
      old_value: { team_id: id, name: existing.name },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/teams/:id/members  { userId }
router.post('/:id/members', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const schema = z.object({ userId: z.number().int().positive() });
    const { userId } = schema.parse(req.body);

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return res.status(404).json({ error: 'User not found' });

    const oldTeamId = user.team_id;
    const [updated] = await db
      .update(users)
      .set({ team_id: teamId })
      .where(eq(users.id, userId))
      .returning();

    await createAuditLog({
      actor_user_id: req.user!.id,
      affected_user_id: userId,
      action: 'team_member_added',
      old_value: { team_id: oldTeamId },
      new_value: { team_id: teamId },
    });
    return res.json(updated);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/teams/:id/members/:userId
router.delete('/:id/members/:userId', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.team_id !== teamId) return res.status(400).json({ error: 'User not in this team' });

    const [updated] = await db
      .update(users)
      .set({ team_id: null })
      .where(eq(users.id, userId))
      .returning();

    await createAuditLog({
      actor_user_id: req.user!.id,
      affected_user_id: userId,
      action: 'team_member_removed',
      old_value: { team_id: teamId },
      new_value: { team_id: null },
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
