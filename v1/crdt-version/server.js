// server.js — CRDT version (Yjs + y-websocket)
//
// THE KEY DIFFERENCE from the other three versions:
//
// websocket-version/server.js    → server holds authoritative content, applies diffs
// socketio-version/server.js     → server holds authoritative content, applies diffs
// webrtc-version/server.js       → server does signaling only (P2P after that)
// THIS FILE                      → server relays binary blobs it never reads or parses
//
// The CRDT merge logic runs entirely inside each browser's Y.Doc instance.
// Two clients editing the same character range simultaneously will BOTH have
// their edits preserved — Yjs deterministically merges them everywhere.
// The server can restart and clients will re-sync missed updates automatically.

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// setupWSConnection is the complete Yjs WebSocket server implementation.
// It handles:
//  - Parsing room name from the URL path  (ws://host/roomname → room = 'roomname')
//  - Maintaining one Y.Doc per room in memory
//  - The Yjs SYNC PROTOCOL (two-step: exchange state vectors → send missing ops)
//  - The AWARENESS PROTOCOL (ephemeral user presence — NOT stored in Y.Doc)
//  - Heartbeats (detects dead connections)
//  - Broadcasting updates to all clients in the same room
const { setupWSConnection } = require('y-websocket/bin/utils');

const app = express();
app.use((req, res, next) => { res.header('Access-Control-Allow-Origin', '*'); next(); });
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

// ── Ping endpoint for latency benchmarking ───────────────────────────────────
// Hit this with fetch('/api/ping') to measure HTTP round-trip to this server.
app.get('/api/ping', (req, res) => {
  res.json({ pong: true, t: Date.now(), transport: 'crdt-yjs' });
});

// ── One line is all the server needs ─────────────────────────────────────────
wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req, { gc: true });
  // gc: true → Yjs garbage-collects deleted items to control memory growth.
  // The Y.Doc for each room is created/reused automatically inside setupWSConnection.
  // Room name = URL path segment: ws://host:3004/my-room → room 'my-room'
});

// ── Optional: LevelDB persistence (commented out for simplicity) ─────────────

 const { LeveldbPersistence } = require('y-leveldb');
 const { setPersistence } = require('y-websocket/bin/utils');
 const ldb = new LeveldbPersistence('./data');
 setPersistence({
   bindState: async (docName, ydoc) => {
     const persistedYdoc = await ldb.getYDoc(docName);
     const newUpdates = Y.encodeStateAsUpdate(ydoc);
     ldb.storeUpdate(docName, newUpdates);
     Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));
     ydoc.on('update', update => ldb.storeUpdate(docName, update));
   },
   writeState: () => {}
 });

const PORT = process.env.PORT || 3004;
server.listen(PORT, () => {
  console.log(`CRDT (Yjs) version → http://localhost:${PORT}`);
  console.log(`  Protocol: binary Yjs sync (not JSON)`);
  console.log(`  Server role: dumb relay — never reads document content`);
  console.log(`  Persistence: in-memory (uncomment LevelDB block for disk)`);
});
