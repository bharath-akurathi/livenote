import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../db/index.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

// ─── Helper: verify access ────────────────────────────────────────────────────
type DocRole = 'owner' | 'editor' | 'commenter' | 'viewer';

async function getDocumentRole(
  docId: string,
  userId: string
): Promise<DocRole | null> {
  const doc = await queryOne<{ owner_id: string; is_public: boolean }>(
    `SELECT owner_id, is_public FROM documents WHERE id=$1`,
    [docId]
  );
  if (!doc) return null;

  if (doc.owner_id === userId) return 'owner';

  if (doc.is_public) return 'viewer';

  const perm = await queryOne<{ role: string }>(
    `SELECT role FROM permissions WHERE document_id=$1 AND user_id=$2`,
    [docId, userId]
  );
  if (perm) return perm.role as DocRole;

  return null;
}

// ── List documents ────────────────────────────────────────────────────────────
documentsRouter.get('/', async (req, res) => {
  const userId = req.user!.userId; // here the ! means, it says that the userId is definitely there, because of requireAuth middleware
  const search = (req.query.search as string) || '';
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  // Get total count first for proper pagination
  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM documents d
     LEFT JOIN permissions p ON p.document_id = d.id AND p.user_id = $1
     WHERE (d.owner_id = $1 OR p.user_id = $1)
       AND ($2 = '' OR d.title ILIKE '%' || $2 || '%')`,
    [userId, search]
  );

  // get all docuent details for the user
  const rows = await query<{
    id: string; title: string; updated_at: string;
    owner_id: string; owner_name: string; role: string;
  }>(
    `SELECT d.id, d.title, d.updated_at, d.owner_id, u.name AS owner_name,
            CASE WHEN d.owner_id = $1 THEN 'owner' ELSE p.role END AS role
     FROM documents d
     JOIN users u ON u.id = d.owner_id
     LEFT JOIN permissions p ON p.document_id = d.id AND p.user_id = $1
     WHERE (d.owner_id = $1 OR p.user_id = $1)
       AND ($2 = '' OR d.title ILIKE '%' || $2 || '%')
     ORDER BY d.updated_at DESC
     LIMIT $3 OFFSET $4`,
    [userId, search, limit, offset]
  );

    // limit means how many documents to fetch, offset means how many documents to skip to get the next set of documents 
    // This is used for pagination
    // offset = (page - 1) * limit  (page is 1-indexed, offset is 0-indexed)
    // So if page = 1, offset = (1 - 1) * 20 = 0, so fetch first 20 documents

  res.json({ documents: rows, total: Number(count), limit, offset });
});

// ── Create document ───────────────────────────────────────────────────────────
documentsRouter.post('/', async (req, res) => {
  const userId = req.user!.userId;
  const title = (req.body.title as string) || 'Untitled document';

  const [doc] = await query<{ id: string; title: string; created_at: string }>(
    `INSERT INTO documents (title, owner_id) VALUES ($1, $2) RETURNING id, title, created_at`,
    [title, userId]
  );
  res.status(201).json(doc);
});

// ── Get single document ───────────────────────────────────────────────────────
documentsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.userId;

  const role = await getDocumentRole(id, userId);
  if (!role) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const doc = await queryOne<{
    id: string; title: string; owner_id: string; owner_name: string;
    content_json: object; is_public: boolean; created_at: string; updated_at: string;
  }>(
    `SELECT d.id, d.title, d.owner_id, u.name AS owner_name,
            d.content_json, d.is_public, d.created_at, d.updated_at
     FROM documents d JOIN users u ON u.id = d.owner_id
     WHERE d.id=$1`,
    [id]
  );
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  res.json({ ...doc, role });
});

// ── Update document metadata ──────────────────────────────────────────────────
const PatchDocSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  is_public: z.boolean().optional(),
});

documentsRouter.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = await getDocumentRole(id, userId);
  if (!role || role === 'viewer' || role === 'commenter') {
    res.status(403).json({ error: 'Editor access required' });
    return;
  }

  const parsed = PatchDocSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { title, is_public } = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (title !== undefined) { sets.push(`title=$${i++}`); vals.push(title); }
  if (is_public !== undefined) { sets.push(`is_public=$${i++}`); vals.push(is_public); }

  if (!sets.length) {
    res.json({ ok: true });
    return;
  }
  vals.push(id);

  await query(`UPDATE documents SET ${sets.join(',')} WHERE id=$${i}`, vals);
  res.json({ ok: true });
});

// ── Delete document ───────────────────────────────────────────────────────────
documentsRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.userId;

  const doc = await queryOne<{ owner_id: string }>(
    `SELECT owner_id FROM documents WHERE id=$1`, [id]
  );
  if (!doc) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (doc.owner_id !== userId) {
    res.status(403).json({ error: 'Owner only' });
    return;
  }

  await query(`DELETE FROM documents WHERE id=$1`, [id]);
  res.json({ ok: true });
});

// ── Share document ────────────────────────────────────────────────────────────
const ShareSchema = z.object({
  email: z.string().email(),
  role: z.enum(['viewer', 'commenter', 'editor']),
});

documentsRouter.post('/:id/share', async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.userId;

  const doc = await queryOne<{ owner_id: string }>(`SELECT owner_id FROM documents WHERE id=$1`, [id]);
  if (!doc) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (doc.owner_id !== userId) {
    res.status(403).json({ error: 'Owner only' });
    return;
  }

  const parsed = ShareSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, role } = parsed.data;
  const target = await queryOne<{ id: string }>(`SELECT id FROM users WHERE email=$1`, [email.toLowerCase()]);
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (target.id === userId) {
    res.status(400).json({ error: 'Cannot share with yourself' });
    return;
  }

  await query(
    `INSERT INTO permissions (document_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (document_id, user_id) DO UPDATE SET role=$3`,
    [id, target.id, role]
  );
  res.json({ ok: true });
});

documentsRouter.delete('/:id/share/:targetUserId', async (req, res) => {
  const { id, targetUserId } = req.params;
  const userId = req.user!.userId;

  const doc = await queryOne<{ owner_id: string }>(`SELECT owner_id FROM documents WHERE id=$1`, [id]);
  if (!doc || doc.owner_id !== userId) {
    res.status(403).json({ error: 'Owner only' });
    return;
  }

  await query(`DELETE FROM permissions WHERE document_id=$1 AND user_id=$2`, [id, targetUserId]);
  res.json({ ok: true });
});

// ── Collaborators list ────────────────────────────────────────────────────────
documentsRouter.get('/:id/collaborators', async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = await getDocumentRole(id, userId);
  if (!role) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const rows = await query(
    `SELECT u.id, u.name, u.email, p.role
     FROM permissions p JOIN users u ON u.id = p.user_id
     WHERE p.document_id=$1`,
    [id]
  );
  res.json(rows);
});

// ── Versions ──────────────────────────────────────────────────────────────────
documentsRouter.get('/:id/versions', async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = await getDocumentRole(id, userId);
  if (!role) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const rows = await query(
    `SELECT v.id, v.label, v.auto, v.created_at, u.name AS created_by_name
     FROM versions v LEFT JOIN users u ON u.id = v.created_by
     WHERE v.document_id=$1 ORDER BY v.created_at DESC LIMIT 50`,
    [id]
  );
  res.json(rows);
});

documentsRouter.post('/:id/versions', async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = await getDocumentRole(id, userId);
  if (!role || role === 'viewer') {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const doc = await queryOne<{ ydoc_state: Buffer; content_json: object }>(
    `SELECT ydoc_state, content_json FROM documents WHERE id=$1`, [id]
  );
  if (!doc?.ydoc_state) {
    res.status(400).json({ error: 'No document state to snapshot' });
    return;
  }

  const label = (req.body.label as string) || null;
  const [ver] = await query<{ id: string; created_at: string }>(
    `INSERT INTO versions (document_id, ydoc_snapshot, content_json, created_by, label, auto)
     VALUES ($1, $2, $3, $4, $5, false) RETURNING id, created_at`,
    [id, doc.ydoc_state, doc.content_json, userId, label]
  );
  res.status(201).json(ver);
});

// ── Get single version (for preview) ──────────────────────────────────────────
documentsRouter.get('/:id/versions/:vid', async (req, res) => {
  const { id, vid } = req.params;
  const userId = req.user!.userId;
  const role = await getDocumentRole(id, userId);
  if (!role) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const ver = await queryOne<{
    id: string; label: string; auto: boolean; content_json: object;
    created_at: string; created_by_name: string;
  }>(
    `SELECT v.id, v.label, v.auto, v.content_json, v.created_at, u.name AS created_by_name
     FROM versions v LEFT JOIN users u ON u.id = v.created_by
     WHERE v.id=$1 AND v.document_id=$2`,
    [vid, id]
  );
  if (!ver) {
    res.status(404).json({ error: 'Version not found' });
    return;
  }

  res.json(ver);
});

documentsRouter.post('/:id/versions/:vid/restore', async (req, res) => {
  const { id, vid } = req.params;
  const userId = req.user!.userId;
  const role = await getDocumentRole(id, userId);
  if (!role || role === 'viewer' || role === 'commenter') {
    res.status(403).json({ error: 'Editor access required' });
    return;
  }

  const ver = await queryOne<{ ydoc_snapshot: Buffer; content_json: object }>(
    `SELECT ydoc_snapshot, content_json FROM versions WHERE id=$1 AND document_id=$2`,
    [vid, id]
  );
  if (!ver) {
    res.status(404).json({ error: 'Version not found' });
    return;
  }

  // Save current state as an auto-version before restoring
  const current = await queryOne<{ ydoc_state: Buffer }>(
    `SELECT ydoc_state FROM documents WHERE id=$1`, [id]
  );
  if (current?.ydoc_state) {
    await query(
      `INSERT INTO versions (document_id, ydoc_snapshot, created_by, label, auto)
       VALUES ($1, $2, $3, 'Before restore', true)`,
      [id, current.ydoc_state, userId]
    );
  }

  await query(
    `UPDATE documents SET ydoc_state=$1, content_json=$2 WHERE id=$3`,
    [ver.ydoc_snapshot, ver.content_json, id]
  );

  res.json({ ok: true });
});
