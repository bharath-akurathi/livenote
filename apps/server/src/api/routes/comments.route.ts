import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../db/index.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const commentsRouter = Router({ mergeParams: true });
commentsRouter.use(requireAuth);

// ─── Helper: verify doc access ─────────────────────────────────────────────────
type DocRole = 'owner' | 'editor' | 'commenter' | 'viewer';

async function getDocumentRole(docId: string, userId: string): Promise<DocRole | null> {
  const doc = await queryOne<{ owner_id: string; is_public: boolean }>(
    `SELECT owner_id, is_public FROM documents WHERE id=$1`,
    [docId]
  );
  if (!doc) return null;
  if (doc.owner_id === userId) return 'owner';

  const perm = await queryOne<{ role: string }>(
    `SELECT role FROM permissions WHERE document_id=$1 AND user_id=$2`,
    [docId, userId]
  );
  if (perm) return perm.role as DocRole;
  if (doc.is_public) return 'viewer';
  return null;
}

// ── List comments for a document ──────────────────────────────────────────────
commentsRouter.get('/', async (req, res) => {
  const { docId } = req.params as { docId: string };
  const userId = req.user!.userId;
  const role = await getDocumentRole(docId, userId);
  if (!role) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const rows = await query(
    `SELECT c.id, c.content, c.range_json, c.parent_id, c.resolved,
            c.created_at, c.updated_at,
            u.id AS user_id, u.name AS user_name, u.email AS user_email
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.document_id = $1
     ORDER BY c.created_at ASC`,
    [docId]
  );
  res.json(rows);
});

// ── Create comment ────────────────────────────────────────────────────────────
const CreateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  range_json: z.object({
    from: z.number(),
    to: z.number(),
    text: z.string().optional(),
  }).optional(),
  parent_id: z.string().uuid().optional(),
});

commentsRouter.post('/', async (req, res) => {
  const { docId } = req.params as { docId: string };
  const userId = req.user!.userId;
  const role = await getDocumentRole(docId, userId);

  // Viewers cannot comment; commenters, editors, and owners can
  if (!role || role === 'viewer') {
    res.status(403).json({ error: 'Comment access required' });
    return;
  }

  const parsed = CreateCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { content, range_json, parent_id } = parsed.data;

  // If replying, verify parent exists and belongs to same doc
  if (parent_id) {
    const parent = await queryOne(
      `SELECT id FROM comments WHERE id=$1 AND document_id=$2`,
      [parent_id, docId]
    );
    if (!parent) {
      res.status(404).json({ error: 'Parent comment not found' });
      return;
    }
  }

  const [comment] = await query<{ id: string; created_at: string }>(
    `INSERT INTO comments (document_id, user_id, content, range_json, parent_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [docId, userId, content, range_json ? JSON.stringify(range_json) : null, parent_id || null]
  );

  res.status(201).json(comment);
});

// ── Update comment (content or resolve status) ────────────────────────────────
const PatchCommentSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  resolved: z.boolean().optional(),
});

commentsRouter.patch('/:cid', async (req, res) => {
  const { docId, cid } = req.params as { docId: string; cid: string };
  const userId = req.user!.userId;
  const role = await getDocumentRole(docId, userId);
  if (!role || role === 'viewer') {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const parsed = PatchCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const comment = await queryOne<{ user_id: string }>(
    `SELECT user_id FROM comments WHERE id=$1 AND document_id=$2`,
    [cid, docId]
  );
  if (!comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }

  const { content, resolved } = parsed.data;

  // Only the comment author can edit content; anyone with comment+ access can resolve
  if (content !== undefined && comment.user_id !== userId) {
    res.status(403).json({ error: 'Only the author can edit comment content' });
    return;
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (content !== undefined) { sets.push(`content=$${i++}`); vals.push(content); }
  if (resolved !== undefined) { sets.push(`resolved=$${i++}`); vals.push(resolved); }

  if (!sets.length) {
    res.json({ ok: true });
    return;
  }
  vals.push(cid, docId);

  await query(
    `UPDATE comments SET ${sets.join(',')} WHERE id=$${i++} AND document_id=$${i}`,
    vals
  );
  res.json({ ok: true });
});

// ── Delete comment ────────────────────────────────────────────────────────────
commentsRouter.delete('/:cid', async (req, res) => {
  const { docId, cid } = req.params as { docId: string; cid: string };
  const userId = req.user!.userId;

  const comment = await queryOne<{ user_id: string }>(
    `SELECT user_id FROM comments WHERE id=$1 AND document_id=$2`,
    [cid, docId]
  );
  if (!comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }

  // Only the comment author or doc owner can delete
  const role = await getDocumentRole(docId, userId);
  if (comment.user_id !== userId && role !== 'owner') {
    res.status(403).json({ error: 'Only author or doc owner can delete' });
    return;
  }

  await query(`DELETE FROM comments WHERE id=$1`, [cid]);
  res.json({ ok: true });
});
