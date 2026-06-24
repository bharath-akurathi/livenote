# **Collaborative Editor Sandbox — Four Ways (v1)**

This project is a version 1 (MVP) learning environment designed to understand how real-time collaborative systems work under the hood. It contains four small, runnable projects, each implementing a collaborative text editor using a different real-time transport or state-sync algorithm.

The UI is intentionally plain — a single \<textarea\> styled to look vaguely like a document page. The point of this project is the sync engine and transport layer, not the editor chrome.

### **The Four Implementations**

| Folder | Transport / Architecture | Port |
| :---- | :---- | :---- |
| websocket-version/ | Raw WebSocket (ws) with naive diff/patch | 3001 |
| socketio-version/ | Socket.io with naive diff/patch | 3002 |
| webrtc-version/ | WebRTC data channels (P2P), WebSocket signaling | 3003 |
| crdt-version/ | Yjs (CRDT) \+ WebSocket / Hocuspocus | 3004 |

## **🚀 Running each version**

Each folder is a standalone Node project.

cd websocket-version   \# or socketio-version, webrtc-version, crdt-version  
npm install  
npm start

Then open the printed localhost URL in **two browser tabs** (or two different browsers) to see edits sync live. Both tabs need to be on the same document — add ?doc=mydoc to the URL to pick a specific document id; everyone on the same ?doc= value is editing together.

You can run all four at once (different ports), open one tab per version, and compare connection behavior side by side — e.g., kill the server process and watch how each client reacts.

## **🏗️ Architecture: What differs between the versions?**

![differences between versions](/v1/diff.png)

### **1\. WebSocket version**

Everything is manual. The server tracks which sockets belong to which document in a Map, broadcasts by looping over that map and skipping the sender, and frames every message with JSON.stringify/JSON.parse itself. The *client* has to implement its own reconnect-with-backoff loop, because a closed WebSocket just stays closed otherwise. There's also a manual ping/pong heartbeat on the server to prevent "zombie" connections.

### **2\. Socket.io version**

Same job, less plumbing. socket.join(docId) and socket.to(docId).emit(...) replace the hand-rolled room map and broadcast loop. Events are named (doc:op, doc:title). The client gets automatic reconnection for free, plus acknowledgement callbacks. Socket.io also transparently falls back to HTTP long-polling if a WebSocket connection can't be established.

### **3\. WebRTC version**

A genuinely different architecture. The Node server here is *only* a signaling relay: it introduces peers to each other and forwards their SDP offers/answers. It never sees document content. Once two browsers complete that handshake, an RTCDataChannel opens **directly between them**, and every edit travels peer-to-peer. With more than two users, this becomes a full mesh network. There is no central database persistence in this version on purpose to highlight the tradeoffs of P2P designs.

### **4\. CRDT version (Yjs)**

**Conflict-free Replicated Data Types**. The first three versions use a naive diff/patch strategy (sending simple { position, insertText } operations). If two people edit the exact same character simultaneously, the naive versions will clobber each other. This version replaces that logic with **Yjs**, a production-grade CRDT library. It mathematically ensures that concurrent edits merge flawlessly. *(Note: This implementation is currently a V1 draft and is actively being improved to handle state history and UI integration more robustly).*

## **📚 Deep Dive: The Theory Behind Collaborative Editors**

If you are exploring this repo to learn about distributed systems, here are the core concepts you need to know.

### **The Problem with "Dumb" Syncing (Versions 1-3)**

On every keystroke in our basic versions, the client turns the change into a small operation based on an index: { position: 3, insertText: "s" }.

Imagine a document with the text: Cat.

* **User A** deletes the "C" (Index 0).  
* **User B** simultaneously adds an "s" to the end (Index 3).

If the server blindly accepts these changes, User A makes the text at, but User B's command tells the system to insert at Index 3\. Because the document is now only 2 letters long, Index 3 no longer exists. The app crashes or corrupts.

To solve this concurrency issue, the industry relies on two major algorithms: **OT** and **CRDTs**.

### **Google Docs and Operational Transformation (OT)**

Google Docs solves this using Operational Transformation.

1. The operations are sent to a central server.  
2. If the server receives User A's delete and User B's insert at the exact same time, the server mathematically **transforms** the operations against each other.  
3. It realizes User A shortened the document, so it dynamically changes User B's operation from Index 3 to Index 2\.  
4. It broadcasts the transformed operations. Everyone converges on ats.

*Drawback:* OT is notoriously difficult to maintain for complex data (like nested folders or shapes) and completely fails if the user goes offline for too long, as it requires the server to constantly mediate the indexes.

### **The Modern Standard: CRDTs (Figma, Notion, Linear)**

CRDTs (used in the crdt-version) solve the problem by **destroying the concept of an array index altogether.**

Instead of referencing a character by its position (Index 0, 1, 2), a CRDT assigns a universally unique, permanent identifier to *every single character* (like fractional math).

* **C** \= 0.2  
* **A** \= 0.4  
* **T** \= 0.6

If User A deletes 0.2 and User B inserts an "S" at 0.8, the order the messages arrive no longer matters. There are no index collisions. The data mathematically merges itself. Because it doesn't rely on a central server to calculate transformations, CRDTs allow for **seamless offline editing** and **peer-to-peer (WebRTC)** architectures.

## **🛠️ Things to poke at once it's running**

* Open the same ?doc= in three tabs for the WebSocket or Socket.io version and watch the user pill list update live.  
* For the WebRTC version, open three tabs and watch the "Direct P2P links" counter — with 3 peers you should see each tab report 2 links.  
* Kill the server process while a tab is open — the status indicator should flip and (for Socket.io) auto-recover the moment you restart it.  
* Type in two tabs at the exact same character position simultaneously in the WebSockets version to see the naive diff/patch conflict firsthand. Then try it in the CRDT version to see it safely resolve\!

## **🚧 Known Issues / v2 Roadmap**

* **CRDT Version Improvements:** The current Yjs implementation is an initial draft. It needs improvements regarding how TipTap/ProseMirror bindings handle local cursor state, and proper database persistence flushing.  
* Add WebRTC TURN server fallback for restrictive NATs.