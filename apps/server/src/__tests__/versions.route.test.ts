import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  createTestApp,
  authHeader,
  TEST_USER,
  TEST_USER_2,
  TEST_DOC,
  TEST_VERSION,
} from './helpers.js';
import { query, queryOne } from '../db/index.js';

const app = createTestApp();

// ── Helper: mock getDocumentRole lookups ──────────────────────────────────────
function mockDocOwner() {
  vi.mocked(queryOne).mockResolvedValueOnce({ owner_id: TEST_USER.id, is_public: false });
}
function mockDocEditor() {
  vi.mocked(queryOne)
    .mockResolvedValueOnce({ owner_id: TEST_USER_2.id, is_public: false })
    .mockResolvedValueOnce({ role: 'editor' });
}
function mockDocViewer() {
  vi.mocked(queryOne)
    .mockResolvedValueOnce({ owner_id: TEST_USER_2.id, is_public: false })
    .mockResolvedValueOnce({ role: 'viewer' });
}
function mockDocNoAccess() {
  vi.mocked(queryOne)
    .mockResolvedValueOnce({ owner_id: TEST_USER_2.id, is_public: false })
    .mockResolvedValueOnce(null);
}

// ═════════════════════════════════════════════════════════════════════════════
// LIST VERSIONS
// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/docs/:id/versions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list versions for accessible doc', async () => {
    mockDocOwner();
    vi.mocked(query).mockResolvedValueOnce([
      { id: TEST_VERSION.id, label: 'v1', auto: false, created_at: '2026-01-01', created_by_name: TEST_USER.name },
    ]);

    const res = await request(app)
      .get(`/api/docs/${TEST_DOC.id}/versions`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].label).toBe('v1');
  });

  it('rejects listing for inaccessible doc → 403', async () => {
    mockDocNoAccess();

    const res = await request(app)
      .get(`/api/docs/${TEST_DOC.id}/versions`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CREATE VERSION (manual snapshot)
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/docs/:id/versions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('create manual snapshot → 201', async () => {
    mockDocOwner();
    // SELECT ydoc_state, content_json
    vi.mocked(queryOne).mockResolvedValueOnce({
      ydoc_state: Buffer.from('test-state'), content_json: { type: 'doc' },
    });
    // INSERT version
    vi.mocked(query).mockResolvedValueOnce([{ id: TEST_VERSION.id, created_at: '2026-01-01' }]);

    const res = await request(app)
      .post(`/api/docs/${TEST_DOC.id}/versions`)
      .set('Authorization', authHeader())
      .send({ label: 'My snapshot' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('viewer cannot create snapshot → 403', async () => {
    mockDocViewer();

    const res = await request(app)
      .post(`/api/docs/${TEST_DOC.id}/versions`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET SINGLE VERSION
// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/docs/:id/versions/:vid', () => {
  beforeEach(() => vi.clearAllMocks());

  it('get single version', async () => {
    mockDocOwner();
    vi.mocked(queryOne).mockResolvedValueOnce({
      id: TEST_VERSION.id, label: 'v1', auto: false,
      content_json: { type: 'doc' }, created_at: '2026-01-01',
      created_by_name: TEST_USER.name,
    });

    const res = await request(app)
      .get(`/api/docs/${TEST_DOC.id}/versions/${TEST_VERSION.id}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.label).toBe('v1');
  });

  it('get non-existent version → 404', async () => {
    mockDocOwner();
    vi.mocked(queryOne).mockResolvedValueOnce(null);

    const res = await request(app)
      .get(`/api/docs/${TEST_DOC.id}/versions/99999999-9999-9999-9999-999999999999`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// RESTORE VERSION
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/docs/:id/versions/:vid/restore', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restore version as editor → 200', async () => {
    mockDocEditor();
    // SELECT ydoc_snapshot from versions
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ ydoc_snapshot: Buffer.from('snapshot-data'), content_json: { type: 'doc' } })
      // SELECT current ydoc_state from documents (for backup)
      .mockResolvedValueOnce({ ydoc_state: Buffer.from('current-state') });
    // INSERT backup version + UPDATE document
    vi.mocked(query)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .post(`/api/docs/${TEST_DOC.id}/versions/${TEST_VERSION.id}/restore`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('restore version as viewer → 403', async () => {
    mockDocViewer();

    const res = await request(app)
      .post(`/api/docs/${TEST_DOC.id}/versions/${TEST_VERSION.id}/restore`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(403);
  });
});
