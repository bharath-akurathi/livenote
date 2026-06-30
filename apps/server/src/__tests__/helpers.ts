/**
 * Shared helpers for tests — app factory, JWT helpers, mock data.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { authRouter } from '../api/routes/auth.route.js';
import { documentsRouter } from '../api/routes/documents.route.js';
import { commentsRouter } from '../api/routes/comments.route.js';
import type { JwtPayload } from '../api/middleware/auth.middleware.js';

// ── Test Express app (mirrors production middleware stack) ─────────────────────
export function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRouter);
  app.use('/api/docs', documentsRouter);
  app.use('/api/docs/:docId/comments', commentsRouter);

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Test error handler:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

// ── JWT helpers ────────────────────────────────────────────────────────────────
const JWT_SECRET = 'test-jwt-secret-for-unit-tests';
const JWT_REFRESH_SECRET = 'test-refresh-secret-for-unit-tests';

export function makeTestAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

export function makeTestRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function makeExpiredToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' });
}

// ── Mock data factories ────────────────────────────────────────────────────────
export const TEST_USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'test@example.com',
  name: 'Test User',
  password: '$2b$12$LJ3m4ys3Lk1kZf0Kb4e1xeI5V6Ge5p8cT6F0M1W5u0qJ/M8rNhDi2', // bcrypt hash of "password123"
};

export const TEST_USER_2 = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'other@example.com',
  name: 'Other User',
};

export const TEST_DOC = {
  id: '33333333-3333-3333-3333-333333333333',
  title: 'Test Document',
  owner_id: TEST_USER.id,
  is_public: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const TEST_COMMENT = {
  id: '44444444-4444-4444-4444-444444444444',
  document_id: TEST_DOC.id,
  user_id: TEST_USER.id,
  content: 'This is a test comment',
  range_json: null,
  parent_id: null,
  resolved: false,
  created_at: '2026-01-01T00:00:00Z',
};

export const TEST_VERSION = {
  id: '55555555-5555-5555-5555-555555555555',
  document_id: TEST_DOC.id,
  ydoc_snapshot: Buffer.from('test-snapshot'),
  content_json: { type: 'doc', content: [] },
  created_by: TEST_USER.id,
  label: 'v1',
  auto: false,
  created_at: '2026-01-01T00:00:00Z',
  created_by_name: TEST_USER.name,
};

export const TEST_JWT_PAYLOAD: JwtPayload = {
  userId: TEST_USER.id,
  email: TEST_USER.email,
  name: TEST_USER.name,
};

/** Convenience: returns an Authorization header value */
export function authHeader(payload: JwtPayload = TEST_JWT_PAYLOAD): string {
  return `Bearer ${makeTestAccessToken(payload)}`;
}
