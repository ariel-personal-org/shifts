import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { signToken, requireAuth, AuthRequest } from '../middleware/auth';
import { isVirtualEmail } from '../utils/virtualUsers';

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
      // Reject sentinel virtual emails — they cannot have real Google credentials
      if (isVirtualEmail(email)) {
        return res.status(403).json({ error: 'Virtual users cannot log in' });
      }

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

    if (user.is_virtual) {
      return res.status(403).json({ error: 'Virtual users cannot log in' });
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
  if (user.is_virtual) return res.status(403).json({ error: 'Virtual users cannot log in' });

  const token = signToken(user.id);
  return res.json({ user, token });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthRequest, res) => {
  return res.json({ user: req.user });
});

// PUT /api/auth/display-name — one-time set by user during onboarding
router.put('/display-name', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.user!.display_name !== null) {
      return res.status(403).json({ error: 'Display name already set' });
    }

    const raw = (req.body as { display_name?: string }).display_name;
    const displayName = typeof raw === 'string' ? raw.trim() : '';
    if (!displayName || displayName.length > 50) {
      return res.status(400).json({ error: 'Display name must be 1-50 characters' });
    }

    const [updated] = await db
      .update(users)
      .set({ display_name: displayName })
      .where(eq(users.id, req.user!.id))
      .returning();
    return res.json({ user: updated });
  } catch (err) {
    console.error('Set display name error:', err);
    return res.status(500).json({ error: 'Failed to set display name' });
  }
});

export default router;
