import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  createTestApp,
  authHeader,
  TEST_USER,
  TEST_USER_2,
  TEST_DOC,
  TEST_COMMENT,
  TEST_JWT_PAYLOAD,
} from './helpers.js';
import { query, queryOne } from '../db/index.js';
import type { JwtPayload } from '../api/middleware/auth.middleware.js';

const app = createTestApp();

// ── Helper: mock getDocumentRole lookups ──────────────────────────────────────
function mockDocOwner() {
  vi.mocked(queryOne).mockResolvedValueOnce({ owner_id: TEST_USER.id, is_public: false });
}
function mockDocCommenter() {
  vi.mocked(queryOne)
    .mockResolvedValueOnce({ owner_id: TEST_USER_2.id, is_public: false })
    .mockResolvedValueOnce({ role: 'commenter' });
}
function mockDocViewer() {
  vi.mocked(queryOne)
    .mockResolvedValueOnce({ owner_id: TEST_USER_2.id, is_public: false })
    .mockResolvedValueOnce({ role: 'viewer' });
}

const COMMENTS_BASE = `/api/docs/${TEST_DOC.id}/comments`;

// ═════════════════════════════════════════════════════════════════════════════
// LIST
// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/docs/:docId/comments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list comments for accessible doc', async () => {
    mockDocOwner();
    vi.mocked(query).mockResolvedValueOnce([
      {
        id: TEST_COMMENT.id, content: TEST_COMMENT.content, range_json: null,
        parent_id: null, resolved: false, created_at: '2026-01-01', updated_at: null,
        user_id: TEST_USER.id, user_name: TEST_USER.name, user_email: TEST_USER.email,
      },
    ]);

    const res = await request(app)
      .get(COMMENTS_BASE)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe(TEST_COMMENT.content);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CREATE
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/docs/:docId/comments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('viewer cannot create comment → 403', async () => {
    mockDocViewer();

    const res = await request(app)
      .post(COMMENTS_BASE)
      .set('Authorization', authHeader())
      .send({ content: 'Should not work' });

    expect(res.status).toBe(403);
  });

  it('commenter can create comment → 201', async () => {
    mockDocCommenter();
    vi.mocked(query).mockResolvedValueOnce([{ id: TEST_COMMENT.id, created_at: '2026-01-01' }]);

    const res = await request(app)
      .post(COMMENTS_BASE)
      .set('Authorization', authHeader())
      .send({ content: 'A new comment' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('create threaded reply with parent_id', async () => {
    mockDocOwner();
    // Check parent exists
    vi.mocked(queryOne).mockResolvedValueOnce({ id: TEST_COMMENT.id });
    // INSERT returns new comment
    vi.mocked(query).mockResolvedValueOnce([{ id: '66666666-6666-6666-6666-666666666666', created_at: '2026-01-01' }]);

    const res = await request(app)
      .post(COMMENTS_BASE)
      .set('Authorization', authHeader())
      .send({ content: 'A reply', parent_id: TEST_COMMENT.id });

    expect(res.status).toBe(201);
  });

  it('reject reply to non-existent parent → 404', async () => {
    mockDocOwner();
    vi.mocked(queryOne).mockResolvedValueOnce(null); // parent not found

    const res = await request(app)
      .post(COMMENTS_BASE)
      .set('Authorization', authHeader())
      .send({ content: 'Orphan reply', parent_id: '99999999-9999-9999-9999-999999999999' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Parent comment not found');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UPDATE (PATCH)
// ═════════════════════════════════════════════════════════════════════════════
describe('PATCH /api/docs/:docId/comments/:cid', () => {
  beforeEach(() => vi.clearAllMocks());

  it('author can edit own comment content', async () => {
    mockDocOwner();
    // SELECT user_id FROM comments
    vi.mocked(queryOne).mockResolvedValueOnce({ user_id: TEST_USER.id });
    vi.mocked(query).mockResolvedValueOnce([]);

    const res = await request(app)
      .patch(`${COMMENTS_BASE}/${TEST_COMMENT.id}`)
      .set('Authorization', authHeader())
      .send({ content: 'Updated content' });

    expect(res.status).toBe(200);
  });

  it('non-author cannot edit content → 403', async () => {
    mockDocCommenter();
    // Comment belongs to a different user
    vi.mocked(queryOne).mockResolvedValueOnce({ user_id: TEST_USER_2.id });

    const res = await request(app)
      .patch(`${COMMENTS_BASE}/${TEST_COMMENT.id}`)
      .set('Authorization', authHeader())
      .send({ content: 'Trying to edit someone else' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Only the author can edit comment content');
  });

  it('anyone with comment+ access can resolve', async () => {
    mockDocCommenter();
    // Comment belongs to another user — but resolve is allowed for anyone
    vi.mocked(queryOne).mockResolvedValueOnce({ user_id: TEST_USER_2.id });
    vi.mocked(query).mockResolvedValueOnce([]);

    const res = await request(app)
      .patch(`${COMMENTS_BASE}/${TEST_COMMENT.id}`)
      .set('Authorization', authHeader())
      .send({ resolved: true });

    expect(res.status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE
// ═════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/docs/:docId/comments/:cid', () => {
  beforeEach(() => vi.clearAllMocks());

  it('author can delete own comment', async () => {
    // SELECT user_id FROM comments
    vi.mocked(queryOne).mockResolvedValueOnce({ user_id: TEST_USER.id });
    // getDocumentRole: owner check (for the "author or owner" check)
    vi.mocked(queryOne).mockResolvedValueOnce({ owner_id: TEST_USER_2.id, is_public: false });
    vi.mocked(queryOne).mockResolvedValueOnce(null); // no perm row — but user is the comment author
    vi.mocked(query).mockResolvedValueOnce([]);

    const res = await request(app)
      .delete(`${COMMENTS_BASE}/${TEST_COMMENT.id}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('doc owner can delete any comment', async () => {
    // SELECT user_id FROM comments (comment belongs to user 2)
    vi.mocked(queryOne).mockResolvedValueOnce({ user_id: TEST_USER_2.id });
    // getDocumentRole: user is the doc owner
    vi.mocked(queryOne).mockResolvedValueOnce({ owner_id: TEST_USER.id, is_public: false });
    vi.mocked(query).mockResolvedValueOnce([]);

    const res = await request(app)
      .delete(`${COMMENTS_BASE}/${TEST_COMMENT.id}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
