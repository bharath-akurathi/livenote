/**
 * Global test setup — runs before all test files.
 * Sets env vars and mocks the DB layer.
 */
import { vi } from 'vitest';

// ── Env vars needed by JWT and other code ──────────────────────────────────────
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-unit-tests';
process.env.NODE_ENV = 'test';

// ── Mock the entire DB module ──────────────────────────────────────────────────
// Path resolves relative to THIS file: src/__tests__/setup.ts → src/db/index.js
vi.mock('../db/index.js', () => ({
  pool: { connect: vi.fn(), query: vi.fn(), on: vi.fn() },
  query: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  runMigrations: vi.fn().mockResolvedValue(undefined),
}));
