// client.js — CRDT version using Yjs
// ─────────────────────────────────────────────────────────────────────────────
// CONCEPTUAL SHIFT vs the other three versions:
//
// In websocket / socketio / webrtc versions:
//   • Server holds THE authoritative document string
//   • Clients send "apply this diff at position X" to the server
//   • Server applies it, broadcasts to others
//   • Two clients editing position 5 simultaneously → one edit CLOBBERS the other
//
// In this version:
//   • EVERY client holds a full Y.Doc (a CRDT document)
//   • Clients send "here is a binary encoded CRDT update blob"
//   • Server blindly relays the blob (never parses it)
//   • Each client's Y.Doc MERGES the blob using the CRDT algorithm
//   • Two clients editing position 5 simultaneously → BOTH edits survive
//   • This is the algorithm used by Notion, Linear, Figma (multiplayer), etc.
//
// The server code became 1 line (setupWSConnection). All the logic moved here.

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const params = new URLSearchParams(location.search);
const docId  = params.get('doc') || 'default';
document.title = `Doc: ${docId} (CRDT/Yjs)`;

const editor      = document.getElementById('editor');
const titleInput  = document.getElementById('doc-title');
const usersEl     = document.getElementById('users');
const statusEl    = document.getElementById('status');
const elOps       = document.getElementById('crdt-ops');
const elBytes     = document.getElementById('crdt-bytes');
const elPeers     = document.getElementById('crdt-peers');
const elClientId  = document.getElementById('crdt-client-id');
document.getElementById('doc-id-label').textContent = docId;

const COLORS = ['#e57373','#64b5f6','#81c784','#ffb74d','#ba68c8','#4db6ac','#f06292','#9575cd'];

// ── 1. Create the root CRDT document ─────────────────────────────────────────
// Y.Doc is a container for named shared types. It has its own unique clientID
// (a random uint32) used to attribute operations to their origin client.
// Two Y.Docs can always be merged, regardless of operation order or network delays.
const ydoc = new Y.Doc();
elClientId.textContent = ydoc.clientID;

// ── 2. Declare shared types ───────────────────────────────────────────────────
// Y.Text is a CRDT string. You can call insert(pos, str) and delete(pos, len)
// on it concurrently from multiple clients and it will always converge to the
// same result. It's similar to a list CRDT where each character has a unique ID.
//
// Naming matters: all clients must use the SAME name ('content', 'title') on
// the SAME Y.Doc to be editing the same shared state.
const ytext  = ydoc.getText('content');
const ytitle = ydoc.getText('title');

// ── 3. Connect via WebSocket ──────────────────────────────────────────────────
// WebsocketProvider does three things simultaneously:
//  a) SYNC: on connect, runs the 2-step Yjs sync protocol with the server
//     (exchange state vectors → server sends any ops this client missed)
//  b) UPDATES: encodes every local Y.Doc change as a binary blob and sends it
//  c) AWARENESS: broadcasts ephemeral state (name, color, cursor) to all peers
//     via a SEPARATE protocol that is NOT stored in the Y.Doc
//
// The URL format is ws://host/roomname — the room name IS the URL path.
// Everyone on the same room name shares the same Y.Doc.
const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
const provider = new WebsocketProvider(
  `${wsProtocol}://${location.host}`,
  docId,
  ydoc
);

// ── 4. Set awareness state (ephemeral presence) ───────────────────────────────
// Awareness is broadcast but NOT persisted. When you close the tab, your
// awareness state disappears from every other client within seconds.
// This is how you implement: who's online, cursor position, "is typing", etc.
const myName  = `Guest ${Math.floor(Math.random() * 9000) + 1000}`;
const myColor = COLORS[Math.floor(Math.random() * COLORS.length)];

provider.awareness.setLocalState({ name: myName, color: myColor });

// ── 5. React to provider lifecycle ───────────────────────────────────────────
provider.on('status', ({ status }) => {
  setStatus(status === 'connected' ? 'connected' : 'disconnected');
});

provider.on('synced', () => {
  // First full sync complete — the Y.Doc now has all server-side content.
  // This is the moment to initialise the textarea from CRDT state.
  setStatus('connected');
  applyDocToTextarea();
});

// ── 6. Observe REMOTE document changes ───────────────────────────────────────
// ytext.observe fires for ALL changes (local + remote). We use transaction.local
// to skip changes we caused ourselves (they're already in the textarea).
//
// The `event.changes.delta` is a Quill-style delta:
//   [{ retain: 5 }, { insert: 'hi' }, { delete: 3 }]
// For simplicity we just re-render from the full CRDT string here.
// A production editor (Monaco + y-monaco) applies the delta incrementally.
let isApplyingRemote = false;

ytext.observe((event, transaction) => {
  if (transaction.local) return;   // ← skip our own changes
  isApplyingRemote = true;
  const savedCursor = editor.selectionStart;
  applyDocToTextarea();
  editor.selectionStart = savedCursor;
  editor.selectionEnd = savedCursor;
  isApplyingRemote = false;
  updateStats();
});

ytitle.observe((event, transaction) => {
  if (transaction.local) return;
  titleInput.value = ytitle.toString();
});

// ── 7. Observe awareness changes (user list) ─────────────────────────────────
// awareness.getStates() returns a Map<clientID, LocalState> for ALL connected
// peers including yourself. It fires whenever anyone joins, leaves, or updates.
provider.awareness.on('change', renderUsers);

// ── 8. Local input → CRDT operations ─────────────────────────────────────────
// We still diff the textarea to find what changed (same as other versions).
// But instead of sending JSON { position, deleteCount, insertText } to a server
// that applies it sequentially, we call ytext.insert/ytext.delete directly:
//
//   ytext.insert(pos, str)  → records a new item in the CRDT linked list
//   ytext.delete(pos, len)  → marks items as "deleted" (tombstones, kept for merging)
//
// ydoc.transact() batches multiple ops into ONE atomic update (one network msg).
// The provider encodes this as a compact binary blob and sends it to the server,
// which broadcasts it to all other peers. Each peer's Y.Doc merges it, producing
// the same result regardless of op arrival order.
let lastContent = '';

editor.addEventListener('input', () => {
  if (isApplyingRemote) return;
  const newContent = editor.value;
  const op = diff(lastContent, newContent);
  lastContent = newContent;
  if (op.deleteCount === 0 && op.insertText.length === 0) return;

  // 'local-input' is the transaction origin — observers can filter on this
  ydoc.transact(() => {
    if (op.deleteCount > 0)       ytext.delete(op.position, op.deleteCount);
    if (op.insertText.length > 0) ytext.insert(op.position, op.insertText);
  }, 'local-input');

  updateStats();
});

let titleTimer;
titleInput.addEventListener('input', () => {
  clearTimeout(titleTimer);
  titleTimer = setTimeout(() => {
    const val = titleInput.value;
    ydoc.transact(() => {
      ytitle.delete(0, ytitle.length);
      ytitle.insert(0, val);
    }, 'local-input');
  }, 300);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function applyDocToTextarea() {
  editor.value = ytext.toString();
  lastContent  = editor.value;
  if (ytitle.length) titleInput.value = ytitle.toString();
}

function diff(oldText, newText) {
  let start = 0;
  const maxStart = Math.min(oldText.length, newText.length);
  while (start < maxStart && oldText[start] === newText[start]) start++;
  let oldEnd = oldText.length, newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd-1] === newText[newEnd-1]) {
    oldEnd--; newEnd--;
  }
  return { position: start, deleteCount: oldEnd - start, insertText: newText.slice(start, newEnd) };
}

function setStatus(state) {
  statusEl.textContent = state === 'connected' ? '● Connected' : '● Reconnecting…';
  statusEl.className   = state === 'connected' ? 'connected'   : 'disconnected';
}

function renderUsers() {
  usersEl.innerHTML = '';
  let count = 0;
  provider.awareness.getStates().forEach((state, clientId) => {
    if (!state.name) return;
    count++;
    const isYou = clientId === ydoc.clientID;
    const pill  = document.createElement('div');
    pill.className = 'user-pill';
    pill.style.background = state.color || '#888';
    pill.textContent = isYou ? `${state.name} (you)` : state.name;
    usersEl.appendChild(pill);
  });
  elPeers.textContent = count;
}

function updateStats() {
  // Count total CRDT items (inserts + tombstoned deletes) in the Y.Doc.
  // This grows monotonically — deleted chars become tombstones, not removed.
  // This is why CRDTs can merge concurrent deletes correctly: the tombstone
  // carries the unique ID of the deleted item, so everyone agrees on what was removed.
  let opCount = 0;
  ydoc.store.clients.forEach(structs => { opCount += structs.length; });
  elOps.textContent = opCount;

  // Encode the full Y.Doc as a binary update blob to show how compact it is.
  // This is what gets sent over the wire (binary, not JSON).
  const update = Y.encodeStateAsUpdate(ydoc);
  const bytes  = update.byteLength;
  elBytes.textContent = bytes < 1024 ? `${bytes}B` : `${(bytes / 1024).toFixed(1)}KB`;
}

// If the doc is already populated when we load (cached), show it immediately.
if (ytext.length) applyDocToTextarea();
updateStats();
