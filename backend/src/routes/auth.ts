import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { signToken, requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const GoogleLoginSchema = z.object({
  credential: z.string().min(1),
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { credential } = GoogleLoginSchema.parse(req.body);

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const { email, name, given_name, family_name } = payload;
    const displayName = name || `${given_name ?? ''} ${family_name ?? ''}`.trim() || email;

    // Check if user exists
    let [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
      // Auto-register new user
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());
      const isAdmin = adminEmails.includes(email.toLowerCase());

      const [newUser] = await db
        .insert(users)
        .values({ name: displayName, email, is_admin: isAdmin })
        .returning();
      user = newUser;
    } else {
      // Check if should be promoted to admin via env
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());
      if (adminEmails.includes(email.toLowerCase()) && !user.is_admin) {
        const [updated] = await db
          .update(users)
          .set({ is_admin: true })
          .where(eq(users.id, user.id))
          .returning();
        user = updated;
      }
    }

    const token = signToken(user.id);
    return res.json({ user, token });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    console.error('Google auth error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

// POST /api/auth/dev-login — local dev only, bypasses Google OAuth
router.post('/dev-login', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not found' });
  }
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: 'email required' });

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return res.status(404).json({ error: 'User not found' });

  const token = signToken(user.id);
  return res.json({ user, token });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthRequest, res) => {
  return res.json({ user: req.user });
});

export default router;
