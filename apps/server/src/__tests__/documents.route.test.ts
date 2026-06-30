import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  createTestApp,
  authHeader,
  TEST_USER,
  TEST_USER_2,
  TEST_DOC,
  TEST_JWT_PAYLOAD,
} from './helpers.js';
import { query, queryOne } from '../db/index.js';
import type { JwtPayload } from '../api/middleware/auth.middleware.js';

const app = createTestApp();

// ── Helper: mock getDocumentRole lookups ──────────────────────────────────────
function mockDocOwner() {
  // SELECT owner_id, is_public
  vi.mocked(queryOne).mockResolvedValueOnce({ owner_id: TEST_USER.id, is_public: false });
}
function mockDocEditor() {
  vi.mocked(queryOne)
    .mockResolvedValueOnce({ owner_id: TEST_USER_2.id, is_public: false }) // not owner
    .mockResolvedValueOnce({ role: 'editor' }); // has permission
}
function mockDocViewer() {
  vi.mocked(queryOne)
    .mockResolvedValueOnce({ owner_id: TEST_USER_2.id, is_public: false })
    .mockResolvedValueOnce({ role: 'viewer' });
}
function mockDocNoAccess() {
  vi.mocked(queryOne)
    .mockResolvedValueOnce({ owner_id: TEST_USER_2.id, is_public: false })
    .mockResolvedValueOnce(null); // no permission row
}

// ═════════════════════════════════════════════════════════════════════════════
// LIST
// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/docs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated list of documents for authenticated user', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: '2' }]) // count query
      .mockResolvedValueOnce([                 // documents query
        { id: TEST_DOC.id, title: 'Doc 1', updated_at: '2026-01-01', owner_id: TEST_USER.id, owner_name: TEST_USER.name, role: 'owner' },
        { id: '00000000-0000-0000-0000-000000000002', title: 'Doc 2', updated_at: '2026-01-02', owner_id: TEST_USER.id, owner_name: TEST_USER.name, role: 'owner' },
      ]);

    const res = await request(app)
      .get('/api/docs')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.documents).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body).toHaveProperty('limit');
    expect(res.body).toHaveProperty('offset');
  });

  it('supports search filter', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: '1' }])
      .mockResolvedValueOnce([{ id: TEST_DOC.id, title: 'Test Document', updated_at: '2026-01-01', owner_id: TEST_USER.id, owner_name: TEST_USER.name, role: 'owner' }]);

    const res = await request(app)
      .get('/api/docs?search=Test')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.documents).toHaveLength(1);
  });

  it('rejects unauthenticated request → 401', async () => {
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CREATE
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/docs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates document with custom title → 201', async () => {
    vi.mocked(query).mockResolvedValueOnce([{ id: TEST_DOC.id, title: 'My Document', created_at: '2026-01-01' }]);

    const res = await request(app)
      .post('/api/docs')
      .set('Authorization', authHeader())
      .send({ title: 'My Document' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('My Document');
  });

  it('creates document with default title → 201', async () => {
    vi.mocked(query).mockResolvedValueOnce([{ id: TEST_DOC.id, title: 'Untitled document', created_at: '2026-01-01' }]);

    const res = await request(app)
      .post('/api/docs')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Untitled document');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET SINGLE
// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/docs/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns document with role for owner', async () => {
    mockDocOwner();
    // queryOne for the full document SELECT
    vi.mocked(queryOne).mockResolvedValueOnce({
      id: TEST_DOC.id, title: TEST_DOC.title, owner_id: TEST_USER.id,
      owner_name: TEST_USER.name, content_json: null, is_public: false,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    });

    const res = await request(app)
      .get(`/api/docs/${TEST_DOC.id}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('owner');
    expect(res.body.title).toBe(TEST_DOC.title);
  });

  it('returns 403 for user without access', async () => {
    mockDocNoAccess();

    const res = await request(app)
      .get(`/api/docs/${TEST_DOC.id}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UPDATE (PATCH)
// ═════════════════════════════════════════════════════════════════════════════
describe('PATCH /api/docs/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('owner can update title', async () => {
    mockDocOwner();
    vi.mocked(query).mockResolvedValueOnce([]);

    const res = await request(app)
      .patch(`/api/docs/${TEST_DOC.id}`)
      .set('Authorization', authHeader())
      .send({ title: 'New Title' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('editor can update title', async () => {
    mockDocEditor();
    vi.mocked(query).mockResolvedValueOnce([]);

    const res = await request(app)
      .patch(`/api/docs/${TEST_DOC.id}`)
      .set('Authorization', authHeader())
      .send({ title: 'Updated by Editor' });

    expect(res.status).toBe(200);
  });

  it('viewer gets 403', async () => {
    mockDocViewer();

    const res = await request(app)
      .patch(`/api/docs/${TEST_DOC.id}`)
      .set('Authorization', authHeader())
      .send({ title: 'Nope' });

    expect(res.status).toBe(403);
  });

  it('rejects invalid body → 400', async () => {
    mockDocOwner();

    const res = await request(app)
      .patch(`/api/docs/${TEST_DOC.id}`)
      .set('Authorization', authHeader())
      .send({ title: '' }); // min 1 char

    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE
// ═════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/docs/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('owner can delete → 200', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ owner_id: TEST_USER.id });
    vi.mocked(query).mockResolvedValueOnce([]);

    const res = await request(app)
      .delete(`/api/docs/${TEST_DOC.id}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('non-owner gets 403', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ owner_id: TEST_USER_2.id });

    const res = await request(app)
      .delete(`/api/docs/${TEST_DOC.id}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(403);
  });

  it('non-existent doc → 404', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce(null);

    const res = await request(app)
      .delete(`/api/docs/${TEST_DOC.id}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SHARE
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/docs/:id/share', () => {
  beforeEach(() => vi.clearAllMocks());

  it('owner can share with another user', async () => {
    // SELECT owner_id
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ owner_id: TEST_USER.id })
      // SELECT id FROM users WHERE email
      .mockResolvedValueOnce({ id: TEST_USER_2.id });
    vi.mocked(query).mockResolvedValueOnce([]);

    const res = await request(app)
      .post(`/api/docs/${TEST_DOC.id}/share`)
      .set('Authorization', authHeader())
      .send({ email: TEST_USER_2.email, role: 'editor' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('cannot share with self → 400', async () => {
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ owner_id: TEST_USER.id })
      .mockResolvedValueOnce({ id: TEST_USER.id }); // target is self

    const res = await request(app)
      .post(`/api/docs/${TEST_DOC.id}/share`)
      .set('Authorization', authHeader())
      .send({ email: TEST_USER.email, role: 'editor' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot share with yourself');
  });

  it('non-owner gets 403', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ owner_id: TEST_USER_2.id });

    const res = await request(app)
      .post(`/api/docs/${TEST_DOC.id}/share`)
      .set('Authorization', authHeader())
      .send({ email: 'someone@example.com', role: 'viewer' });

    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UNSHARE
// ═════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/docs/:id/share/:targetUserId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('owner can revoke access', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ owner_id: TEST_USER.id });
    vi.mocked(query).mockResolvedValueOnce([]);

    const res = await request(app)
      .delete(`/api/docs/${TEST_DOC.id}/share/${TEST_USER_2.id}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// COLLABORATORS
// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/docs/:id/collaborators', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of collaborators for accessible doc', async () => {
    mockDocOwner();
    vi.mocked(query).mockResolvedValueOnce([
      { id: TEST_USER_2.id, name: TEST_USER_2.name, email: TEST_USER_2.email, role: 'editor' },
    ]);

    const res = await request(app)
      .get(`/api/docs/${TEST_DOC.id}/collaborators`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].role).toBe('editor');
  });
});
