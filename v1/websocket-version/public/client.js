// client.js — raw WebSocket client
//
// Note everything we have to do by hand here: build the ws:// URL, frame
// every message as JSON.stringify/parse, and implement our own reconnect
// loop with backoff. Compare to socketio-version/public/client.js where
// the io() client handles connection, reconnection, and event framing.

const params = new URLSearchParams(location.search);
const docId = params.get('doc') || 'default';
document.title = `Doc: ${docId} (WebSocket)`;

const editor = document.getElementById('editor');
const titleInput = document.getElementById('doc-title');
const usersEl = document.getElementById('users');
const statusEl = document.getElementById('status');
document.getElementById('doc-id-label').textContent = docId;

let ws;
let myId = null;
let lastContent = '';      // last content we know the server has
let applyingRemote = false; // guards against re-broadcasting incoming changes
let reconnectDelay = 1000;

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocol}://${location.host}?doc=${encodeURIComponent(docId)}`);

  ws.addEventListener('open', () => {
    setStatus('connected');
    reconnectDelay = 1000; // reset backoff once we're back
  });

  ws.addEventListener('message', (event) => {
    handleMessage(JSON.parse(event.data));
  });

  ws.addEventListener('close', () => {
    setStatus('disconnected');
    // Raw WebSocket does not reconnect on its own — we have to retry ourselves.
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5, 10000); // exponential backoff, max 10s
  });

  ws.addEventListener('error', () => ws.close());
}

function setStatus(state) {
  statusEl.textContent = state === 'connected' ? '● Connected' : '● Reconnecting…';
  statusEl.className = state;
}

function handleMessage(msg) {
  if (msg.type === 'init') {
    myId = msg.you.id;
    lastContent = msg.content;
    applyingRemote = true;
    editor.value = msg.content;
    applyingRemote = false;
    titleInput.value = msg.title;
    renderUsers(msg.users);
  } else if (msg.type === 'op') {
    applyRemoteOp(msg.op);
  } else if (msg.type === 'title') {
    titleInput.value = msg.title;
  } else if (msg.type === 'presence') {
    renderUsers(msg.users);
  }
}

// Apply a remote insert/delete operation to our local textarea while trying
// to keep the local cursor in a sensible place.
function applyRemoteOp(op) {
  const cursorStart = editor.selectionStart;
  const cursorEnd = editor.selectionEnd;

  applyingRemote = true;
  const before = editor.value;
  const after = before.slice(0, op.position) + op.insertText + before.slice(op.position + op.deleteCount);
  // op.position is the index in the string where the change starts
  // op.deleteCount is the number of characters to delete starting at op.position
  // op.insertText is the string to insert at op.position
  // so we take the substring before the position, add the insertText, and then add the substring after the deleted characters
  
  editor.value = after;
  lastContent = after;

  editor.selectionStart = adjustCursor(cursorStart, op);
  editor.selectionEnd = adjustCursor(cursorEnd, op);
  applyingRemote = false;
}

function adjustCursor(pos, op) {
  const delta = op.insertText.length - op.deleteCount;
  if (pos <= op.position) return pos;
  if (pos <= op.position + op.deleteCount) return op.position + op.insertText.length;
  return pos + delta;
}

// Simple common-prefix / common-suffix diff. Good enough to turn a single
// keystroke, paste, or delete into a compact {position, deleteCount, insertText}
// operation. This is *not* full Operational Transformation — see the README
// for what that means for two people typing in the exact same spot at once.
function diff(oldText, newText) {
  let start = 0;
  const maxStart = Math.min(oldText.length, newText.length);
  while (start < maxStart && oldText[start] === newText[start]) start++;

  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }

  return { position: start, deleteCount: oldEnd - start, insertText: newText.slice(start, newEnd) };
}

editor.addEventListener('input', () => {
  if (applyingRemote) return;
  const newContent = editor.value;
  const op = diff(lastContent, newContent);
  if (op.deleteCount === 0 && op.insertText.length === 0) return;
  lastContent = newContent;
  send({ type: 'op', op });
});

let titleTimer;
titleInput.addEventListener('input', () => {
  clearTimeout(titleTimer);
  titleTimer = setTimeout(() => send({ type: 'title', title: titleInput.value }), 300);
});

function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function renderUsers(users) {
  usersEl.innerHTML = '';
  users.forEach((u) => {
    const pill = document.createElement('div');
    pill.className = 'user-pill';
    pill.style.background = u.color;
    pill.textContent = u.id === myId ? `${u.name} (you)` : u.name;
    usersEl.appendChild(pill);
  });
}

connect();
