-- LiveNote: Initial schema
-- Safe to re-run (CREATE TABLE IF NOT EXISTS)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  password    TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ── Documents ──────────────────────────────────────────────────────────────────
-- ydoc_state: raw Y.encodeStateAsUpdate() binary (never store as JSON — see SRS NFR-05)
-- content_json: ProseMirror JSON snapshot, for search/preview only
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL DEFAULT 'Untitled document',
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- ON DELETE CASCADE means that if the owner is deleted, the document will also be deleted.
  ydoc_state    BYTEA,
  -- BYTEA is a binary data type that is used to store binary data.
  content_json  JSONB,
  -- JSONB is a binary JSON data type.
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id); -- this index is used to query documents by owner_id.
CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC); -- this index is used to query documents by updated_at.
CREATE INDEX IF NOT EXISTS idx_documents_title ON documents USING gin(to_tsvector('english', title)); -- this index is used to query documents by title.

-- ── Permissions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('viewer', 'commenter', 'editor')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_permissions_user ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_doc ON permissions(document_id);

-- ── Version snapshots ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ydoc_snapshot BYTEA NOT NULL,
  content_json  JSONB,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  label         TEXT,
  auto          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_versions_doc ON versions(document_id, created_at DESC);

-- ── Comments ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  range_json  JSONB,     -- { from, to, text } ProseMirror range
  parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE,
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_doc ON comments(document_id);

-- ── Refresh tokens ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ── Triggers: updated_at ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
    CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_documents_updated_at') THEN
    CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_comments_updated_at') THEN
    CREATE TRIGGER trg_comments_updated_at BEFORE UPDATE ON comments
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;
