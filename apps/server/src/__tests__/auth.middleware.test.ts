import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { requireAuth, makeAccessToken, makeRefreshToken, verifyRefreshToken } from '../api/middleware/auth.middleware.js';
import type { Request, Response, NextFunction } from 'express';
import { TEST_JWT_PAYLOAD } from './helpers.js';

// ── Helpers to build mock req/res/next ────────────────────────────────────────
function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as Request;
}

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Auth Middleware', () => {
  const next: NextFunction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects request with no Authorization header → 401', () => {
    const req = mockReq();
    const res = mockRes();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with malformed header (no "Bearer " prefix) → 401', () => {
    const req = mockReq({ headers: { authorization: 'Token abc123' } as any });
    const res = mockRes();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with invalid/expired JWT → 401', () => {
    const req = mockReq({ headers: { authorization: 'Bearer invalid.token.here' } as any });
    const res = mockRes();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes and attaches req.user with valid JWT', () => {
    const token = makeAccessToken(TEST_JWT_PAYLOAD);
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } as any });
    const res = mockRes();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe(TEST_JWT_PAYLOAD.userId);
    expect(req.user!.email).toBe(TEST_JWT_PAYLOAD.email);
  });
});

describe('Token helpers', () => {
  it('makeAccessToken produces a verifiable token', () => {
    const token = makeAccessToken(TEST_JWT_PAYLOAD);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    expect(decoded.userId).toBe(TEST_JWT_PAYLOAD.userId);
    expect(decoded.email).toBe(TEST_JWT_PAYLOAD.email);
    expect(decoded.name).toBe(TEST_JWT_PAYLOAD.name);
    expect(decoded.exp).toBeDefined();
  });

  it('makeRefreshToken / verifyRefreshToken roundtrip', () => {
    const token = makeRefreshToken(TEST_JWT_PAYLOAD);
    const decoded = verifyRefreshToken(token);

    expect(decoded.userId).toBe(TEST_JWT_PAYLOAD.userId);
    expect(decoded.email).toBe(TEST_JWT_PAYLOAD.email);
  });
});
