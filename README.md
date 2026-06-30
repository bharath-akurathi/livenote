<h1 align="center">
  📝 LiveNote
</h1>

<p align="center">
  <strong>A production-grade, real-time collaborative document editor — Google Docs, built from scratch.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React 18" />
  <img src="https://img.shields.io/badge/Tiptap-v2-000000?style=flat-square" alt="Tiptap v2" />
  <img src="https://img.shields.io/badge/Yjs-CRDT-6E4CDD?style=flat-square" alt="Yjs" />
  <img src="https://img.shields.io/badge/Hocuspocus-v4-FF4785?style=flat-square" alt="Hocuspocus" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Express-v5-000000?style=flat-square&logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
</p>

---

## ✨ What is LiveNote?

LiveNote is a full-stack collaborative document editor that lets multiple users write, edit, and comment on documents simultaneously — with no conflicts, no data loss, and seamless offline support.

Built with **Yjs CRDTs** for conflict-free merging, **Hocuspocus v4** as the WebSocket collaboration backend, and **Tiptap** (a ProseMirror-based rich text editor) on the frontend.

---

## 🚀 Features

### ✍️ Rich Text Editing
- **Bold, Italic, Underline, Strikethrough**
- **Headings** H1–H3
- **Lists** — Bullet & Ordered
- **Code blocks** with syntax highlighting
- **Blockquotes, Horizontal rules, Hyperlinks**
- **Text alignment** — Left, Center, Right, Justify
- **Slash commands** `/` for quick formatting
- **Per-user Undo/Redo** via `Y.UndoManager` (won't undo teammates' changes)

### 🤝 Real-Time Collaboration
- Multiple users edit the **same document simultaneously** with CRDT-based conflict-free merge (no last-write-wins)
- **Live cursor positions** with user name + color labels (Yjs Awareness protocol)
- **Presence indicator** — see who is currently in the document
- **Offline editing** — changes are buffered in IndexedDB (`y-indexeddb`) and automatically synced on reconnect

### 🔐 Authentication & Security
- Email + password registration with **bcrypt** hashing (cost = 12)
- **JWT access tokens** (15-minute expiry) + **refresh tokens** (7 days) stored in `httpOnly` cookies
- JWT verified on every WebSocket connection by Hocuspocus
- Rate limiting: 100 requests/min per IP on all REST endpoints
- Parameterized SQL queries (no string interpolation)
- Helmet.js security headers + CORS allowlist

### 📄 Document Management
- Create, read, update, delete documents
- Document list with **search/filter by title**
- **Inline title editing**
- Auto-save every ~1s via CRDT persistence

### 🔗 Sharing & Permissions
- Share document by email with a role: `viewer` / `commenter` / `editor`
- Role-based access enforced at the WebSocket level (`onAuthenticate`)
- Viewers get read-only connections (no write access, enforced server-side)

### 🕐 Version History
- Auto-snapshot every **100 ops** (configurable via `AUTO_SNAPSHOT_OPS`)
- Manual "Save version" with a label
- List versions with timestamp + author
- Preview any version (read-only)
- Restore a version (creates a new snapshot from it)

### 💬 Comments *(Phase 2)*
- Anchor comments to text ranges
- Threaded replies
- Resolve / Unresolve

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                        │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Tiptap     │  │ HocuspocusProvider│  │  y-indexeddb │  │
│  │  Editor     │◄─┤  (WebSocket)      │  │  (Offline)   │  │
│  │  + Yjs ext  │  └────────┬─────────┘  └───────────────┘  │
│  └─────────────┘           │                                 │
└────────────────────────────│────────────────────────────────┘
                             │ wss://
                             │
┌────────────────────────────▼────────────────────────────────┐
│                   COLLAB SERVER (Hocuspocus v4)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  onAuthenticate → JWT verify + permission check      │   │
│  │  onLoadDocument → SELECT ydoc_state FROM PostgreSQL  │   │
│  │  onChange       → debounced binary write to DB       │   │
│  │  onDisconnect   → flush state + JSON snapshot write  │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    REST API (Express 5 + JWT)                │
│  POST /auth/register   POST /auth/login                     │
│  GET  /docs            POST /docs                           │
│  GET  /docs/:id        PATCH /docs/:id    DELETE /docs/:id  │
│  GET  /docs/:id/versions    POST /docs/:id/share            │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                       PostgreSQL 16                          │
│  users │ documents │ permissions │ versions │ comments       │
│  refresh_tokens                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧰 Tech Stack

### Frontend (`apps/client`)
| Layer | Choice | Why |
|---|---|---|
| Framework | React 18 + Vite | Fast HMR, ESM-native |
| Editor | Tiptap v2 | Best Yjs integration, highly extensible |
| CRDT | Yjs 13.x | Fastest CRDT, battle-tested |
| WS Client | `@hocuspocus/provider` | Auth hooks, reconnect, awareness |
| Offline | `y-indexeddb` | Browser-local Y.Doc cache |
| State | Zustand | Minimal, no boilerplate |
| Styling | TailwindCSS | Utility-first |
| HTTP | Axios | Interceptors for token refresh |
| Routing | React Router v6 | |

### Backend (`apps/server`)
| Layer | Choice | Why |
|---|---|---|
| Collab WS | Hocuspocus v4 (MIT) | Production Yjs server, auth/persistence hooks |
| REST API | Express 5 | Familiar, fast to build |
| DB | `node-postgres` (pg) | Direct SQL, full control |
| Auth | JWT + bcrypt | Stateless, refresh via httpOnly cookie |
| Database | PostgreSQL 16 | Binary `bytea` for Y.Doc, reliable |
| Validation | Zod | Runtime schema validation |
| Rate limit | `express-rate-limit` | Per-IP protection |

---

## 📁 Project Structure

```
LiveNote/
├── apps/
│   ├── client/                    # Vite + React frontend
│   │   └── src/
│   │       ├── components/
│   │       │   ├── Editor/
│   │       │   │   ├── CollabEditor.tsx      # Tiptap + Yjs + Hocuspocus wired together
│   │       │   │   ├── Toolbar.tsx           # Rich text formatting toolbar
│   │       │   │   ├── SlashCommandMenu.tsx  # Slash command picker
│   │       │   │   └── SlashCommands.ts      # Slash command definitions
│   │       │   ├── CommentsPanel.tsx         # Threaded comments sidebar
│   │       │   ├── ShareDialog.tsx           # Share-by-email dialog
│   │       │   ├── VersionPanel.tsx          # Version history panel
│   │       │   └── UI/                       # Button, Modal, Avatar, Spinner...
│   │       ├── hooks/
│   │       │   └── useCollaboration.ts       # Hocuspocus provider + awareness hook
│   │       ├── pages/
│   │       │   ├── LandingPage.tsx
│   │       │   ├── LoginPage.tsx
│   │       │   ├── RegisterPage.tsx
│   │       │   ├── DashboardPage.tsx
│   │       │   └── DocumentPage.tsx
│   │       ├── stores/
│   │       │   ├── authStore.ts              # Zustand auth state
│   │       │   └── uiStore.ts               # UI state (panels, modals)
│   │       └── lib/
│   │           └── api.ts                   # Axios instance with token refresh
│   │
│   └── server/                    # Node.js backend
│       └── src/
│           ├── collab/
│           │   └── hocuspocus.ts            # WebSocket collab server hooks
│           ├── api/
│           │   ├── routes/
│           │   │   ├── auth.route.ts        # Register, login, refresh, logout
│           │   │   ├── documents.route.ts   # CRUD, sharing, versions
│           │   │   └── comments.route.ts    # Comments CRUD
│           │   └── middleware/
│           │       └── auth.middleware.ts   # JWT verification middleware
│           ├── db/
│           │   ├── index.ts                 # pg Pool + query helpers
│           │   └── migrations/001_init.sql  # Full DB schema
│           └── index.ts                     # Express app + server bootstrap
│
├── .env.example                   # Environment variable template
└── SRS_doc.md                     # Software Requirements Specification
```

---

## ⚙️ Getting Started

### Prerequisites

- **Node.js** >= 18
- **PostgreSQL** 16 (or a [Supabase](https://supabase.com) project)

### 1. Clone the repo

```bash
git clone https://github.com/bharath-akurathi/livenote.git
cd livenote
```

### 2. Set up environment variables

Copy the example env files and fill in your values:

```bash
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env
```

Edit `apps/server/.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:[password]@localhost:5432/livenote

# JWT Secrets — generate with: openssl rand -hex 64
JWT_SECRET=your-jwt-secret-change-me
JWT_REFRESH_SECRET=your-refresh-secret-change-me

# Server
PORT=3000
HOCUSPOCUS_PORT=1234
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

Create `apps/client/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_COLLAB_URL=ws://localhost:1234
```

### 3. Set up the database

Run the init migration to create all tables:

```bash
# Option A — using the migrate script
npm run migrate --workspace=@livenote/server

# Option B — apply the SQL directly
psql $DATABASE_URL -f apps/server/src/db/migrations/001_init.sql
```

> **Supabase users:** Use your Supabase pooled connection string as `DATABASE_URL`. SSL is auto-detected.

### 4. Start the application (Dev Mode)

Since this is an NPM Monorepo Workspace, you can start both the client and server concurrently from the root directory:

```bash
npm install
npm run dev
# → REST API & WebSockets on   http://localhost:3000
# → React Frontend (Vite) on   http://localhost:5173
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Login, receive tokens |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/logout` | Revoke refresh token |

### Documents
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/docs` | List documents (`?search=&page=&limit=`) |
| `POST` | `/api/docs` | Create document |
| `GET` | `/api/docs/:id` | Get document metadata |
| `PATCH` | `/api/docs/:id` | Update title |
| `DELETE` | `/api/docs/:id` | Delete document |

### Sharing & Versions
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/docs/:id/share` | Share with `{ email, role }` |
| `DELETE` | `/api/docs/:id/share/:userId` | Revoke access |
| `GET` | `/api/docs/:id/versions` | List version history |
| `POST` | `/api/docs/:id/versions` | Manual snapshot |
| `GET` | `/api/docs/:id/versions/:vid` | Fetch snapshot |
| `POST` | `/api/docs/:id/versions/:vid/restore` | Restore a version |

### Comments
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/docs/:id/comments` | Get all comments |
| `POST` | `/api/docs/:id/comments` | Add comment |
| `PATCH` | `/api/docs/:id/comments/:cid` | Edit / resolve |
| `DELETE` | `/api/docs/:id/comments/:cid` | Delete comment |

---

## 🗄️ Database Schema

<details>
<summary>Click to expand full schema</summary>

```sql
-- Users
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  password    TEXT NOT NULL,  -- bcrypt hash
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Documents
CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL DEFAULT 'Untitled document',
  owner_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  ydoc_state    BYTEA,    -- Y.encodeStateAsUpdate() binary
  content_json  JSONB,   -- ProseMirror JSON for search/preview
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Role-based permissions
CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('viewer','commenter','editor')),
  UNIQUE(document_id, user_id)
);

-- Version snapshots
CREATE TABLE versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID REFERENCES documents(id) ON DELETE CASCADE,
  ydoc_snapshot BYTEA NOT NULL,
  content_json  JSONB,
  created_by    UUID REFERENCES users(id),
  label         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  content     TEXT NOT NULL,
  range_json  JSONB,    -- ProseMirror anchor range
  parent_id   UUID REFERENCES comments(id),
  resolved    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

</details>

---

## 🔒 Security

- Passwords hashed with **bcrypt** (cost factor = 12)
- Access tokens expire in **15 minutes**; refresh tokens in 7 days
- Refresh tokens stored in **httpOnly, SameSite=Strict** cookies
- Hocuspocus validates JWT on **every WebSocket connection**
- All SQL uses **parameterized queries** (no string interpolation)
- Rate limiting: **100 req/min** per IP on all REST endpoints
- **Helmet.js** security headers on Express
- **CORS allowlist** only — no wildcard origins
- Input validation with **Zod** on all REST routes

---

## 📊 Performance Targets

| Metric | Target |
|---|---|
| Edit latency (same datacenter) | < 100ms p95 |
| Concurrent users per document | 50+ without degradation |
| Uptime | 99.9% |
| Cold-load time (first byte) | < 200ms |

---

## 🧪 Testing

The backend is fully tested using **Vitest** and **Supertest**, with all database calls safely mocked at the module level. 

- **56/56 passing tests** executing in under 1 second.
- Comprehensive coverage of:
  - Auth Middleware & Routes (Register, Login, Refresh, Logout, Me)
  - Document Routes (CRUD, search/filter, role-based access checks)
  - Version History (Snapshots, fetching, restoring)
  - Comments (Creation, threaded replies, editing, resolving, deletions)

To run the test suite from the root directory:
```bash
npm test --workspace=@livenote/server
# For watch mode: npm run test:watch --workspace=@livenote/server
```

---

## 🧑‍💻 Development Scripts

Run these from the **root directory** of the project:

```bash
npm install      # Installs dependencies for both client and server
npm run dev      # Starts both Vite (client) and tsx (server) in watch mode
npm run build    # Compiles both client and server for production
npm start        # Starts the production server (Node.js serves both API and static frontend)
```

## 🐳 Docker Deployment

LiveNote is optimized for production deployment via Docker Compose. We provide a highly efficient multi-stage `Dockerfile` and a `docker-compose.yml` that sets up PostgreSQL and the LiveNote server together.

```bash
# Set your production secrets
echo "JWT_SECRET=super_secret_random_string" > .env

# Build and start the containers
docker-compose up -d --build
```

The application will be running on `http://localhost:3000` (which serves the API, WebSockets, AND the static compiled React app).

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment architecture options.

---

## 🤝 Contributing

1. Fork the repo and create a feature branch
2. Make your changes with clear commit messages
3. Open a pull request describing what you built and why

---

## 📄 License

MIT — use it, fork it, build on it.

---

<p align="center">Built with ❤️ using Yjs, Tiptap, Hocuspocus, and PostgreSQL</p>
