// server.js — raw WebSocket version
//
// Everything here is done "by hand": tracking which sockets belong to which
// document, broadcasting to the right subset of clients, and parsing/framing
// messages ourselves with JSON.stringify/parse. Compare this file to the
// socketio-version/server.js to see what Socket.io gives you for free.

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// `ws` just upgrades the raw HTTP server to speak the WebSocket protocol.

const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public'))); // serve static files from public/ (including client.js and index.html)

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// docId -> { content, title, clients: Map<ws, user>, saveTimer }
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
  fs.writeFile(file, JSON.stringify({ content: room.content, title: room.title }), (err) => {
    if (err) console.error('Save failed', err);
  });
}

function getRoom(docId) {
  if (!docs.has(docId)) {
    const persisted = loadDoc(docId);
    docs.set(docId, {
      content: persisted.content,
      title: persisted.title,
      clients: new Map(), // ws -> { id, name, color }
      saveTimer: null,
    });
  }
  return docs.get(docId);
}

// Manual fan-out: loop every client in the room ourselves and skip the sender.
// Socket.io's `socket.to(room).emit(...)` does this in one call.
function broadcast(room, data, exclude) {
  const msg = JSON.stringify(data);
  for (const client of room.clients.keys()) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

function userList(room) {
  return Array.from(room.clients.values());
}

function scheduleSave(docId, room) {
  // clear any pending save so we don't spam the disk with every keystroke
  clearTimeout(room.saveTimer); 
  // debounce saves to avoid spamming the disk on every keystroke, for every 1 second of inactivity
  room.saveTimer = setTimeout(() => saveDoc(docId, room), 1000); 
}

wss.on('connection', (ws, req) => {
  // We have to parse the doc id out of the URL ourselves — no built-in handshake.query like Socket.io has.
  const url = new URL(req.url, `http://${req.headers.host}`);
  const docId = url.searchParams.get('doc') || 'default';
  const room = getRoom(docId);

  userCounter++;
  const user = {
    id: `user-${userCounter}-${Date.now()}`,
    name: `Guest ${userCounter}`,
    color: COLORS[userCounter % COLORS.length],
  };
  room.clients.set(ws, user);

  ws.send(JSON.stringify({
    type: 'init',
    content: room.content,
    title: room.title,
    you: user,
    users: userList(room),
  }));

  broadcast(room, { type: 'presence', users: userList(room) }, ws);

  // Heartbeat: raw WebSocket connections can silently die (e.g. laptop sleep,
  // flaky wifi) without ever firing a 'close' event. We ping periodically and
  // terminate anything that doesn't pong back. Socket.io does this for you.
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; }); 
  // what is pong? 
  // it's a built-in WebSocket frame type that is sent in response to ping frames

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return; // ignore malformed frames
    }

    if (msg.type === 'op') { 
      // what is op? 
      // op is an operation that describes a change to the document content, such as an insertion or deletion
      // we apply the operation to the server's copy of the document, and then broadcast it to all other clients in the room
      const { position, deleteCount, insertText } = msg.op;
      room.content =
        room.content.slice(0, position) + insertText + room.content.slice(position + deleteCount);
      scheduleSave(docId, room);
      broadcast(room, { type: 'op', op: msg.op }, ws);
    } else if (msg.type === 'title') {
      room.title = msg.title;
      scheduleSave(docId, room);
      broadcast(room, { type: 'title', title: room.title }, ws);
    } else if (msg.type === 'cursor') {
      broadcast(room, { type: 'cursor', userId: user.id, position: msg.position }, ws);
    }
  });

  ws.on('close', () => {
    room.clients.delete(ws);
    broadcast(room, { type: 'presence', users: userList(room) });
    if (room.clients.size === 0) {
      docs.delete(docId); // content is already persisted to disk
    }
  });
});

// Manual heartbeat loop across every connected client.
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping(); 
    // ping means "are you alive?" and the client will respond with a pong frame, which we listen for above
  });
}, 30000); // ping every 30 seconds

wss.on('close', () => clearInterval(heartbeat));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket version running at http://localhost:${PORT}`);
});
