// server.js — WebRTC signaling server
//
// This server's ONLY job is to help two browsers find each other and swap
// the connection setup info (SDP offers/answers, ICE candidates) needed to
// open a direct RTCDataChannel between them. Once that channel is open,
// every keystroke travels straight from one browser to the other — it
// never touches this server. Compare that to websocket-version/server.js
// and socketio-version/server.js, where the server relays every edit AND
// holds the authoritative copy of the document.
//
// Because of that, this server doesn't store document content at all, and
// there's no "data/" persistence folder like the other two versions —
// there's no single source of truth to persist. That's a real tradeoff of
// peer-to-peer architectures, see the README for more on it.

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

// docId -> Map<peerId, { ws, meta }>
const rooms = new Map();
const COLORS = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4db6ac', '#f06292', '#9575cd'];
let peerCounter = 0;

function getRoom(docId) {
  if (!rooms.has(docId)) rooms.set(docId, new Map());
  return rooms.get(docId);
}

function peerInfo(id, meta) {
  return { id, name: meta.name, color: meta.color };
}

function broadcastExcept(room, exceptId, data) {
  const msg = JSON.stringify(data);
  for (const [pid, entry] of room.entries()) {
    if (pid !== exceptId && entry.ws.readyState === WebSocket.OPEN) {
      entry.ws.send(msg);
    }
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const docId = url.searchParams.get('doc') || 'default';
  const room = getRoom(docId);

  peerCounter++;
  const id = `peer-${peerCounter}-${Date.now()}`;
  const meta = { name: `Guest ${peerCounter}`, color: COLORS[peerCounter % COLORS.length] };

  // Tell the newcomer who is already in the room — the client will
  // initiate a WebRTC connection to each of them.
  const existingPeers = Array.from(room.entries()).map(([pid, entry]) => peerInfo(pid, entry.meta));
  room.set(id, { ws, meta });
  ws.send(JSON.stringify({ type: 'welcome', id, peers: existingPeers, you: peerInfo(id, meta) }));

  // Tell everyone already there that a newcomer exists, so they know to
  // expect (and answer) an incoming offer.
  broadcastExcept(room, id, { type: 'peer-joined', peer: peerInfo(id, meta) });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    if (msg.type === 'signal') {
      // Pure relay: forward this SDP/ICE payload to exactly the peer it's
      // addressed to. The server never reads or understands `msg.data`.
      const target = room.get(msg.to);
      if (target && target.ws.readyState === WebSocket.OPEN) {
        target.ws.send(JSON.stringify({ type: 'signal', from: id, data: msg.data }));
      }
    }
  });

  ws.on('close', () => {
    room.delete(id);
    broadcastExcept(room, id, { type: 'peer-left', id });
    if (room.size === 0) rooms.delete(docId);
  });
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  console.log(`WebRTC signaling server running at http://localhost:${PORT}`);
});
