// client.js — WebRTC version
//
// The WebSocket connection here is used ONLY for signaling: exchanging the
// SDP (means "Session Description Protocol")
// offers/answers and ICE (means "Interactive Connectivity Establishment")
// candidates needed to set up a direct RTCPeerConnection between browsers. 
// 
// Once a data channel is open, document
// operations travel straight from one browser to another — they never pass
// through the server again. Compare to websocket-version/public/client.js
// and socketio-version/public/client.js, where every keystroke is relayed
// through a server that also holds the authoritative document.
//
// Topology: this builds a full mesh — every peer connects directly to
// every other peer in the room. That's simple to reason about and fine for
// a handful of users learning how this works, but doesn't scale the way a
// server-relayed approach does (each new peer needs N new connections).

const params = new URLSearchParams(location.search);
const docId = params.get('doc') || 'default';
document.title = `Doc: ${docId} (WebRTC)`;

const editor = document.getElementById('editor');
const titleInput = document.getElementById('doc-title');
const usersEl = document.getElementById('users');
const statusEl = document.getElementById('status');
const linksEl = document.getElementById('links');
document.getElementById('doc-id-label').textContent = docId;

// Public STUN server, just for NAT traversal during connection setup (figuring
// out each browser's public IP/port). No TURN server is configured, so this
// will work on localhost and most home/office networks, but may fail to
// connect directly across some restrictive corporate or symmetric NATs —
// a production app would add a TURN server as a relay fallback for those cases.
const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let signalSocket;
let myId = null;
let myMeta = null;
let lastContent = '';       // our local copy of the document
let applyingRemote = false; // guards against re-broadcasting incoming changes
let hasSyncedContent = false; // have we adopted a starting document yet?
const peersMeta = new Map();  // peerId -> { id, name, color }
const peers = new Map();      // peerId -> { pc, channel, candidateQueue }

function connectSignaling() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  signalSocket = new WebSocket(`${protocol}://${location.host}?doc=${encodeURIComponent(docId)}`);

  signalSocket.addEventListener('open', () => setSignalStatus('connected'));
  signalSocket.addEventListener('close', () => {
    setSignalStatus('disconnected');
    setTimeout(connectSignaling, 1500);
  });
  signalSocket.addEventListener('message', (event) => handleSignalMessage(JSON.parse(event.data)));
}

function setSignalStatus(state) {
  statusEl.textContent = state === 'connected' ? '● Signaling connected' : '● Reconnecting…';
  statusEl.className = state;
}

function handleSignalMessage(msg) {
  if (msg.type === 'welcome') {
    myId = msg.id;
    myMeta = msg.you;
    msg.peers.forEach((p) => peersMeta.set(p.id, p));
    if (msg.peers.length === 0) {
      // Empty room: there's nobody to sync from, so our blank document is correct.
      hasSyncedContent = true;
    }
    renderUsers();
    // We're the newcomer for every existing peer — we initiate the offer
    // (and own creating the data channel) for each of them.
    msg.peers.forEach((p) => createPeerConnection(p.id, true));
  } else if (msg.type === 'peer-joined') {
    peersMeta.set(msg.peer.id, msg.peer);
    renderUsers();
    // Don't initiate anything yet — just wait for their incoming offer.
    // This one-directional rule (newcomer always offers) avoids both sides
    // racing to create an offer at the same time ("glare").
  } else if (msg.type === 'peer-left') {
    closePeer(msg.id);
    peersMeta.delete(msg.id);
    renderUsers();
  } else if (msg.type === 'signal') {
    handleSignal(msg.from, msg.data);
  }
}

function getOrCreatePeer(id, isInitiator) {
  if (peers.has(id)) return peers.get(id);
  return createPeerConnection(id, isInitiator);
}

function createPeerConnection(id, isInitiator) {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  const entry = { pc, channel: null, candidateQueue: [] };
  peers.set(id, entry);

  pc.onicecandidate = (event) => {
    if (event.candidate) sendSignal(id, { candidate: event.candidate });
  };

  pc.onconnectionstatechange = () => {
    renderUsers();
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') closePeer(id);
  };

  if (isInitiator) {
    // Creating the data channel BEFORE the offer is what causes the offer's
    // SDP to actually include that channel.
    const channel = pc.createDataChannel('doc');
    setupChannel(id, channel);
    pc.onnegotiationneeded = async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(id, { sdp: pc.localDescription });
    };
  } else {
    // The incoming offer carries its own data channel — it arrives here.
    pc.ondatachannel = (event) => setupChannel(id, event.channel);
  }

  return entry;
}

function setupChannel(id, channel) {
  const entry = peers.get(id);
  entry.channel = channel;

  channel.addEventListener('open', () => {
    renderLinks();
    // If we already have a settled document, hand it to whoever just connected.
    if (hasSyncedContent) {
      channel.send(JSON.stringify({ type: 'sync', content: lastContent, title: titleInput.value }));
    }
  });

  channel.addEventListener('close', () => renderLinks());

  channel.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'sync') {
      if (!hasSyncedContent) {
        hasSyncedContent = true;
        lastContent = msg.content;
        applyingRemote = true;
        editor.value = msg.content;
        applyingRemote = false;
        titleInput.value = msg.title;
      }
    } else if (msg.type === 'op') {
      applyRemoteOp(msg.op);
    } else if (msg.type === 'title') {
      titleInput.value = msg.title;
    }
  });
}

async function handleSignal(fromId, data) {
  const entry = getOrCreatePeer(fromId, false);
  const { pc } = entry;

  if (data.sdp) {
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    // Flush any ICE candidates that arrived before we had a remote description set.
    for (const candidate of entry.candidateQueue) await pc.addIceCandidate(candidate);
    entry.candidateQueue = [];

    if (data.sdp.type === 'offer') {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(fromId, { sdp: pc.localDescription });
    }
  } else if (data.candidate) {
    if (pc.remoteDescription && pc.remoteDescription.type) {
      await pc.addIceCandidate(data.candidate);
    } else {
      // Remote description isn't set yet — queue it for later instead of erroring.
      entry.candidateQueue.push(data.candidate);
    }
  }
}

function sendSignal(to, data) {
  signalSocket.send(JSON.stringify({ type: 'signal', to, data }));
}

function closePeer(id) {
  const entry = peers.get(id);
  if (!entry) return;
  if (entry.channel) entry.channel.close();
  entry.pc.close();
  peers.delete(id);
  renderLinks();
}

// Fan out directly to every open peer connection - this is the mesh
// broadcast that replaces a server relay.
function broadcastToPeers(data) {
  const msg = JSON.stringify(data);
  for (const entry of peers.values()) {
    if (entry.channel && entry.channel.readyState === 'open') entry.channel.send(msg);
  }
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

// Same common-prefix/common-suffix diff used by the other two versions —
// the sync strategy doesn't change, only the transport does.
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
  broadcastToPeers({ type: 'op', op });
});

let titleTimer;
titleInput.addEventListener('input', () => {
  clearTimeout(titleTimer);
  titleTimer = setTimeout(() => broadcastToPeers({ type: 'title', title: titleInput.value }), 300);
});

function renderUsers() {
  usersEl.innerHTML = '';
  if (myMeta) {
    const pill = document.createElement('div');
    pill.className = 'user-pill';
    pill.style.background = myMeta.color;
    pill.textContent = `${myMeta.name} (you)`;
    usersEl.appendChild(pill);
  }
  peersMeta.forEach((p) => {
    const pill = document.createElement('div');
    pill.className = 'user-pill';
    pill.style.background = p.color;
    const entry = peers.get(p.id);
    const linked = entry && entry.channel && entry.channel.readyState === 'open';
    pill.textContent = `${p.name}${linked ? '' : ' (connecting…)'}`;
    pill.style.opacity = linked ? '1' : '0.6';
    usersEl.appendChild(pill);
  });
  renderLinks();
}

function renderLinks() {
  const total = peersMeta.size;
  const open = Array.from(peers.values()).filter((e) => e.channel && e.channel.readyState === 'open').length;
  linksEl.textContent = total === 0 ? 'No other peers yet' : `Direct P2P links: ${open}/${total}`;
}

connectSignaling();
