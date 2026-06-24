// server.js — Socket.io version
//
// Same collaborative-editing logic as websocket-version/server.js, but
// using the features Socket.io provides on top of raw WebSockets: rooms
// (socket.join), scoped broadcasting (socket.to(room).emit), named events
// instead of a hand-rolled `type` field, and acknowledgement callbacks.
// It also automatically falls back to HTTP long-polling if a WebSocket
// connection can't be established, and reconnects on the client for free.

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// docId -> { content, title, users: Map<socketId, user>, saveTimer }
const docs = new Map();

const COLORS = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4db6ac', '#f06292', '#9575cd'];
let userCounter = 0;

function loadDoc(docId) {
  const file = path.join(DATA_DIR, `${docId}.json`);
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
      console.error('Failed to parse saved doc', docId, e);
    }
  }
  return { content: '', title: 'Untitled document' };
}

function saveDoc(docId, room) {
  const file = path.join(DATA_DIR, `${docId}.json`);
  fs.writeFile(file, JSON.stringify({ content: room.content, title: room.title }), () => {});
}

function getRoom(docId) {
  if (!docs.has(docId)) {
    const persisted = loadDoc(docId);
    docs.set(docId, {
      content: persisted.content,
      title: persisted.title,
      users: new Map(),
      saveTimer: null,
    });
  }
  return docs.get(docId);
}

function userList(room) {
  return Array.from(room.users.values());
}

function scheduleSave(docId, room) {
  clearTimeout(room.saveTimer);
  room.saveTimer = setTimeout(() => saveDoc(docId, room), 1000);
}

io.on('connection', (socket) => {
  const docId = socket.handshake.query.doc || 'default';
  const room = getRoom(docId);

  // Socket.io's room feature — one call instead of maintaining our own
  // Map<ws, user> per document like the raw WebSocket version does.
  socket.join(docId);

  userCounter++;
  const user = { id: socket.id, name: `Guest ${userCounter}`, color: COLORS[userCounter % COLORS.length] };
  room.users.set(socket.id, user);

  socket.emit('doc:init', { content: room.content, title: room.title, you: user, users: userList(room) });

  // socket.to(docId) broadcasts to everyone in that room except the sender —
  // no manual loop-and-skip needed.
  socket.to(docId).emit('presence:update', userList(room));

  socket.on('doc:op', (op) => {
    room.content = room.content.slice(0, op.position) + op.insertText + room.content.slice(op.position + op.deleteCount);
    scheduleSave(docId, room);
    socket.to(docId).emit('doc:op', op);
  });

  // Acknowledgement callback: the client passes a function as the last
  // argument and we call it once the server has processed the event. Raw
  // WebSocket has no equivalent — you'd have to invent your own request/response
  // correlation (e.g. message ids) to get the same thing.
  socket.on('doc:title', (title, ack) => {
    room.title = title;
    scheduleSave(docId, room);
    socket.to(docId).emit('doc:title', title);
    if (typeof ack === 'function') ack({ ok: true, savedAt: Date.now() });
  });

  socket.on('cursor:update', (position) => {
    socket.to(docId).emit('cursor:update', { userId: socket.id, position });
  });

  socket.on('disconnect', () => {
    room.users.delete(socket.id);
    socket.to(docId).emit('presence:update', userList(room));
    if (room.users.size === 0) docs.delete(docId);
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Socket.io version running at http://localhost:${PORT}`);
});
