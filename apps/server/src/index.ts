import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { authRouter } from './api/routes/auth.route.js';
import { documentsRouter } from './api/routes/documents.route.js';
import { commentsRouter } from './api/routes/comments.route.js';
import { runMigrations } from './db/index.js';
import { createHocuspocusServer } from './collab/hocuspocus.js';

const PORT = Number(process.env.PORT) || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // ── Run DB migrations ────────────────────────────────────────────────────────
  // await runMigrations();  // For people who clone the project, uncomment this to create DB tables

  // ── Express & HTTP Server ───────────────────────────────────────────────────
  const app = express();
  const server = createServer(app);

  // ── Hocuspocus WebSocket server ──────────────────────────────────────────────
  const hocuspocus = createHocuspocusServer();
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    // Accept WebSocket connections on the /collaboration path
    if (request.url?.startsWith('/collaboration')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        // ws is the upgraded WebSocket instance
        hocuspocus.handleConnection(ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Security headers
  app.use(helmet());

  // CORS — whitelist only
  app.use(cors({
    origin: CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Rate limiting: 100 requests per minute per IP
  app.use(rateLimit({
    windowMs: 60_000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api/auth', authRouter);
  app.use('/api/docs', documentsRouter);
  // Comments are nested under documents: /api/docs/:docId/comments
  app.use('/api/docs/:docId/comments', commentsRouter);

  // 404 catch for API
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ── Serve React Frontend in Production ──────────────────────────────────────
  if (process.env.NODE_ENV === 'production') {
    // In production, this file is in apps/server/dist/index.js
    const clientDistPath = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDistPath));
    
    // Any other request (not API) serves index.html for client-side routing
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  } else {
    // Dev fallback
    app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔌 WebSockets listening on /collaboration`);
    console.log(`   Client URL: ${CLIENT_URL}`);
    if (process.env.NODE_ENV === 'production') {
      console.log(`📦 Serving static frontend from client/dist`);
    }
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
