import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import {
  createTestApp,
  makeTestRefreshToken,
  TEST_USER,
  TEST_JWT_PAYLOAD,
  authHeader,
} from './helpers.js';
import { query, queryOne } from '../db/index.js';

const app = createTestApp();

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers successfully with valid data → 201', async () => {
    // No existing user
    vi.mocked(queryOne).mockResolvedValueOnce(null);
    // INSERT returns new user
    vi.mocked(query)
      .mockResolvedValueOnce([{ id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name }])
      // INSERT refresh token
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', name: 'New User', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user).toHaveProperty('email');
    // Should set refresh_token cookie
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('rejects invalid email → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', name: 'Test', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects short password (< 8 chars) → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', name: 'Test', password: 'short' });

    expect(res.status).toBe(400);
  });

  it('rejects duplicate email → 409', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ id: TEST_USER.id });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'existing@example.com', name: 'Test', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already in use');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs in successfully → 200', async () => {
    const hash = await bcrypt.hash('password123', 4); // low rounds for speed
    vi.mocked(queryOne).mockResolvedValueOnce({
      id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name, password: hash,
    });
    // INSERT refresh token
    vi.mocked(query).mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe(TEST_USER.email);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
  });

  it('rejects wrong email → 401', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('rejects wrong password → 401', async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    vi.mocked(queryOne).mockResolvedValueOnce({
      id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name, password: hash,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });
});

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns new access token with valid refresh cookie → 200', async () => {
    const refreshToken = makeTestRefreshToken(TEST_JWT_PAYLOAD);
    // DB finds the stored refresh token
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ id: 'token-row-id' })
      // DB finds the user
      .mockResolvedValueOnce({ id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.id).toBe(TEST_USER.id);
  });

  it('rejects with no cookie → 401', async () => {
    const res = await request(app).post('/api/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No refresh token');
  });

  it('rejects with expired/revoked token → 401', async () => {
    const refreshToken = makeTestRefreshToken(TEST_JWT_PAYLOAD);
    // DB finds no matching token (revoked)
    vi.mocked(queryOne).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token revoked or expired');
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears cookie and deletes token from DB → 200', async () => {
    const refreshToken = makeTestRefreshToken(TEST_JWT_PAYLOAD);
    vi.mocked(query).mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `refresh_token=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    // query should have been called to DELETE the token
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM refresh_tokens'),
      [refreshToken]
    );
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user data with valid access token → 200', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({
      id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name, avatar_url: null,
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(TEST_USER.email);
  });

  it('rejects without token → 401', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });
});
