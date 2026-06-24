// client.js — Socket.io client
//
// Compare to websocket-version/public/client.js: no manual URL building,
// no manual reconnect loop, no manual JSON.stringify/parse — the io()
// client and named events handle all of that.

const params = new URLSearchParams(location.search);
const docId = params.get('doc') || 'default';
document.title = `Doc: ${docId} (Socket.io)`;

const editor = document.getElementById('editor');
const titleInput = document.getElementById('doc-title');
const usersEl = document.getElementById('users');
const statusEl = document.getElementById('status');
document.getElementById('doc-id-label').textContent = docId;

let myId = null;
let lastContent = '';
let applyingRemote = false;

// socket.io-client handles reconnection (with backoff), transport fallback
// to long-polling, and message framing for us.
const socket = io({ query: { doc: docId } });

socket.on('connect', () => setStatus('connected'));
socket.on('disconnect', () => setStatus('disconnected'));
socket.io.on('reconnect_attempt', () => setStatus('reconnecting'));

socket.on('doc:init', ({ content, title, you, users }) => {
  myId = you.id;
  lastContent = content;
  applyingRemote = true;
  editor.value = content;
  applyingRemote = false;
  titleInput.value = title;
  renderUsers(users);
});

socket.on('doc:op', (op) => applyRemoteOp(op));
socket.on('doc:title', (title) => { titleInput.value = title; });
socket.on('presence:update', (users) => renderUsers(users));

function setStatus(state) {
  const labels = { connected: '● Connected', disconnected: '● Disconnected', reconnecting: '● Reconnecting…' };
  statusEl.textContent = labels[state] || labels.disconnected;
  statusEl.className = state === 'connected' ? 'connected' : 'disconnected';
}

function applyRemoteOp(op) {
  const cursorStart = editor.selectionStart;
  const cursorEnd = editor.selectionEnd;

  applyingRemote = true;
  const before = editor.value;
  const after = before.slice(0, op.position) + op.insertText + before.slice(op.position + op.deleteCount);
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

// Same diff approach as the WebSocket version — the sync strategy doesn't
// change, only the transport does.
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
  socket.emit('doc:op', op);
});

let titleTimer;
titleInput.addEventListener('input', () => {
  clearTimeout(titleTimer);
  titleTimer = setTimeout(() => {
    // Acknowledgement callback — a Socket.io feature with no raw-WebSocket
    // equivalent. The server calls this once it has processed the event.
    socket.emit('doc:title', titleInput.value, (response) => {
      console.log('title save acknowledged:', response);
    });
  }, 300);
});

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
