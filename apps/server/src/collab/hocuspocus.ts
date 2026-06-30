/**
 * Hocuspocus v4 collaboration server
 *
 * Responsibilities:
 *  1. onAuthenticate  → verify JWT, check doc permission
 *  2. onLoadDocument  → load Y.Doc binary from PostgreSQL
 *  3. onChange        → debounced write of Y.Doc binary to PostgreSQL
 *  4. onDisconnect    → flush state + write JSON snapshot for search
 *  5. Auto-snapshot   → every AUTO_SNAPSHOT_OPS ops, save a version row
 */

import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { pool, queryOne, query } from '../db/index.js';

interface CollabContext {
  userId: string;
  userName: string;
  email: string;
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
  documentId: string;
}

const AUTO_SNAPSHOT_OPS = 100;
// Track op counts per document (in-memory, resets on server restart)
const opCounts = new Map<string, number>();

export function createHocuspocusServer() {
  return Server.configure({
    port: Number(process.env.HOCUSPOCUS_PORT) || 1234,
    timeout: 30_000,
    quiet: process.env.NODE_ENV === 'production',

    // ── 1. AUTH ────────────────────────────────────────────────────────────────
    async onAuthenticate({ token, documentName, connection }) {
      if (!token) throw new Error('No token');

      let payload: { userId: string; email: string; name: string };
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET!) as typeof payload;
      } catch {
        throw new Error('Invalid token');
      }

      const { userId, email, name } = payload;
      const documentId = documentName; // room name = document UUID

      // Validate UUID to prevent injection
      if (!/^[0-9a-f-]{36}$/.test(documentId)) throw new Error('Invalid document ID');

      // Look up document and check permissions
      const doc = await queryOne<{ owner_id: string; is_public: boolean }>(
        `SELECT owner_id, is_public FROM documents WHERE id=$1`,
        [documentId]
      );
      if (!doc) throw new Error('Document not found');

      let role: CollabContext['role'];
      if (doc.owner_id === userId) {
        role = 'owner';
      } else {
        const perm = await queryOne<{ role: string }>(
          `SELECT role FROM permissions WHERE document_id=$1 AND user_id=$2`,
          [documentId, userId]
        );
        if (perm) {
          role = perm.role as CollabContext['role'];
        } else if (doc.is_public) {
          role = 'viewer';
        } else {
          throw new Error('Access denied');
        }
      }

      const ctx: CollabContext = {
        userId, email, role, documentId, userName: name ?? email,
      };

      // Set readOnly on connection for viewers
      connection.readOnly = (role === 'viewer');
      return ctx;
    },

    // ── 2. LOAD DOCUMENT ───────────────────────────────────────────────────────
    async onLoadDocument({ documentName, document }) {
      const row = await queryOne<{ ydoc_state: Buffer }>(
        `SELECT ydoc_state FROM documents WHERE id=$1`, [documentName]
      );

      if (row?.ydoc_state) {
        // Apply the stored binary update to the in-memory Y.Doc
        Y.applyUpdate(document, new Uint8Array(row.ydoc_state));
      }
      // If null → brand new empty doc, nothing to apply
      return document;
    },

    // ── 3. ON CHANGE (debounced persistence) ──────────────────────────────────
    async onChange({ documentName, document, context }) {
      // Increment op count, auto-snapshot at threshold
      const count = (opCounts.get(documentName) ?? 0) + 1;
      opCounts.set(documentName, count);

      if (count % AUTO_SNAPSHOT_OPS === 0) {
        const state = Y.encodeStateAsUpdate(document);
        await query(
          `INSERT INTO versions (document_id, ydoc_snapshot, created_by, label, auto)
           VALUES ($1, $2, $3, $4, true)`,
          [documentName, Buffer.from(state), (context as CollabContext)?.userId ?? null, `Auto #${count}`]
          // Auto is true to indicate that this is an auto-generated snapshot.
          // the syntax Auto + "#" + count is used to generate a unique label for each auto-generated snapshot
          // by incrementing the count in each call to onchange() method.
          // We are using Buffer.from(state) to convert the binary state to a buffer.
        );
      }

      // Persist binary state
      const state = Y.encodeStateAsUpdate(document);
      await query(
        `UPDATE documents SET ydoc_state=$1, updated_at=NOW() WHERE id=$2`,
        [Buffer.from(state), documentName]
      );
    },

    // ── 4. ON DISCONNECT (flush JSON snapshot) ─────────────────────────────────
    async onDisconnect({ documentName, document, clientsCount }) {
      // Write the JSON snapshot for search/preview only when last user leaves
      if (clientsCount > 0) return;

      const state = Y.encodeStateAsUpdate(document);
      await query(
        `UPDATE documents SET ydoc_state=$1, updated_at=NOW() WHERE id=$2`,
        [Buffer.from(state), documentName]
      );

      // Reset op counter for this document
      opCounts.delete(documentName);
    },
  });
}
