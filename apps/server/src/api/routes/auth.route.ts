import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { query, queryOne } from '../../db/index.js';
import {
  makeAccessToken,
  makeRefreshToken,
  verifyRefreshToken,
  requireAuth,
  type JwtPayload,
} from '../middleware/auth.middleware.js';

export const authRouter = Router();

const BCRYPT_ROUNDS = 12;
const REFRESH_TTL_DAYS = 7;

// ── Register ──────────────────────────────────────────────────────────────────
const RegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
});

authRouter.post('/register', async (req, res) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { email, name, password } = parsed.data;

    const existing = await queryOne('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [user] = await query<{ id: string; email: string; name: string }>(
      `INSERT INTO users (email, name, password) VALUES ($1, $2, $3)
     RETURNING id, email, name`,
      [email.toLowerCase(), name, hash]
    );

    const jwtPayload: JwtPayload = { userId: user.id, email: user.email, name: user.name };
    const accessToken = makeAccessToken(jwtPayload);
    const refreshToken = makeRefreshToken(jwtPayload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );

    res
      .cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
      })
      .status(201)
      .json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }

});

// ── Login ─────────────────────────────────────────────────────────────────────
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;
  const user = await queryOne<{ id: string; email: string; name: string; password: string }>(
    `SELECT id, email, name, password FROM users WHERE email=$1`,
    [email.toLowerCase()]
  );
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const jwtPayload: JwtPayload = { userId: user.id, email: user.email, name: user.name };
  const accessToken = makeAccessToken(jwtPayload);
  const refreshToken = makeRefreshToken(jwtPayload);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);
  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [user.id, refreshToken, expiresAt]
  );

  res
    .cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    })
    .json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
});

// ── Refresh ───────────────────────────────────────────────────────────────────
authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  const stored = await queryOne(
    `SELECT id FROM refresh_tokens WHERE token=$1 AND expires_at > NOW()`,
    [token]
  );
  if (!stored) {
    res.status(401).json({ error: 'Token revoked or expired' });
    return;
  }

  // Get fresh user data
  const user = await queryOne<{ id: string; email: string; name: string }>(
    `SELECT id, email, name FROM users WHERE id=$1`,
    [payload.userId]
  );
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  const accessToken = makeAccessToken({ userId: user.id, email: user.email, name: user.name });
  res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
});

// ── Logout ────────────────────────────────────────────────────────────────────
authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (token) {
    await query(`DELETE FROM refresh_tokens WHERE token=$1`, [token]);
  }
  res.clearCookie('refresh_token').json({ ok: true });
});

// ── Me (get current user from token) ──────────────────────────────────────────
authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await queryOne<{ id: string; email: string; name: string; avatar_url: string | null }>(
    `SELECT id, email, name, avatar_url FROM users WHERE id=$1`,
    [req.user!.userId]
  );
  // req?user.id => if req is null or undefined, return undefined. otherwise return req.user.id
  // req!user.id => if req is null or undefined, throw an error.
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});
