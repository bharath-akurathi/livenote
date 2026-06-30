/**
 * useCollaboration — sets up the full Yjs CRDT collaboration stack for a document:
 *
 *  Y.Doc  ←── IndexedDB (offline cache)
 *    ↕
 *  HocuspocusProvider (WebSocket)
 *    → onAuthenticate on server verifies JWT
 *    → syncs Y.Doc binary with PostgreSQL via Hocuspocus hooks
 *    → awareness = live cursor/user presence (NOT stored in Y.Doc)
 */
import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { IndexeddbPersistence } from 'y-indexeddb';
import { getAccessToken } from '../lib/api';
import type { AwarenessUser } from '../types';

const defaultUrl = import.meta.env.PROD 
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/collaboration`
  : 'ws://localhost:3000/collaboration';

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL || defaultUrl;

// Palette of accessible colors for user cursors

const CURSOR_COLORS = [
  '#e57373', '#64b5f6', '#81c784', '#ffb74d',
  '#ba68c8', '#4db6ac', '#f06292', '#9575cd',
  '#444','#eee', '#a78bfa', '#10b981', '#f59e0b',
  '#ef4444',
];

let colorIndex = 0;

interface UseCollaborationOptions {
  documentId: string;
  userName: string;
}

interface CollabState {
  provider: HocuspocusProvider | null;
  ydoc: Y.Doc | null;
  connected: boolean;
  synced: boolean;
  awarenessUsers: Map<number, AwarenessUser>;
  userColor: string;
}

export function useCollaboration({ documentId, userName }: UseCollaborationOptions): CollabState {
  const [state, setState] = useState<CollabState>({
    provider: null,
    ydoc: null,
    connected: false,
    synced: false,
    awarenessUsers: new Map(),
    userColor: CURSOR_COLORS[0],
  });

  useEffect(() => {
    if (!documentId) return;

    // const color = CURSOR_COLORS[colorIndex++ % CURSOR_COLORS.length];
    let color = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    // if color is too light, make it darker
    if (parseInt(color.slice(1), 16) > 0x888888) {
      color = "#" + Math.floor(Math.random() * 0x888888).toString(16).padStart(6, '0');
    }
    if (parseInt(color.slice(1), 16) < 0x444444) {
      color = "#" + Math.floor(Math.random() * 0x444444 + 0x444444).toString(16).padStart(6, '0');
    }
    


    // ── Create Y.Doc ──────────────────────────────────────────────────────────
    const ydoc = new Y.Doc();

    // ── IndexedDB offline cache ──────────────────────────────────────────────
    const idb = new IndexeddbPersistence(`livenote-${documentId}`, ydoc);

    // ── Hocuspocus WebSocket provider ─────────────────────────────────────────
    const token = getAccessToken();
    const provider = new HocuspocusProvider({
      url: COLLAB_URL,
      name: documentId,
      document: ydoc,
      token: token || '',

      onConnect() {
        setState((s) => ({ ...s, connected: true }));
        provider.setAwarenessField('user', { name: userName, color } as AwarenessUser);
      },

      onDisconnect() {
        setState((s) => ({ ...s, connected: false }));
      },

      onSynced() {
        setState((s) => ({ ...s, synced: true }));
      },

      onAwarenessChange({ states }: any) {
        const users = new Map<number, AwarenessUser>();
        if (Array.isArray(states)) {
          states.forEach((s: any) => {
            if (s?.user) users.set(s.clientId, s.user);
          });
        }
        setState((s) => ({ ...s, awarenessUsers: users }));
      },
    });

    setState({
      provider, ydoc, connected: false, synced: false,
      awarenessUsers: new Map(), userColor: color,
    });

    return () => {
      provider.destroy();
      idb.destroy();
      ydoc.destroy();
    };
  }, [documentId, userName]);

  return state;
}
