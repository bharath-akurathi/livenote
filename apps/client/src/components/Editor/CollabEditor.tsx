/**
 * CollabEditor — Tiptap + Yjs collaborative editor
 *
 * Wires together:
 *  - Tiptap (ProseMirror) as the rich text editor UI
 *  - @tiptap/extension-collaboration → binds Tiptap to Y.Doc (CRDT)
 *  - @tiptap/extension-collaboration-cursor → renders live cursor labels
 *  - HocuspocusProvider → WebSocket CRDT sync
 *  - y-indexeddb → offline cache
 */
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import UnderlineExt from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import { Toolbar } from './Toolbar';
import { useUIStore } from '../../stores/uiStore';
import type { AwarenessUser } from '../../types';
import { Bold, Italic, Underline, Code, Link2, X, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { Avatar } from '../UI/Avatar';
import { ResizableSidebar } from '../UI/ResizableSidebar';
import { SlashCommandMenu } from './SlashCommandMenu';

import { FontSize } from './FontSize';
import { TextStyle } from '@tiptap/extension-text-style';

interface Props {
  ydoc: Y.Doc;
  provider: HocuspocusProvider;
  userName: string;
  userColor: string;
  awarenessUsers: Map<number, AwarenessUser>;
  readOnly?: boolean;
}

export function CollabEditor({
  ydoc,
  provider,
  userName,
  userColor,
  awarenessUsers,
  readOnly = false,
}: Props) {
  const presenceSidebarOpen = useUIStore((s) => s.presenceSidebarOpen);
  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      // StarterKit: Bold, Italic, Strike, Code, CodeBlock, Blockquote,
      // BulletList, OrderedList, HardBreak, Heading, HorizontalRule
      // DISABLE StarterKit's History because Yjs provides per-user undo
      StarterKit.configure({
        history: false,
      }),

      // ── Yjs CRDT binding ──────────────────────────────────────────────────
      Collaboration.configure({
        document: ydoc,
      }),

      // ── Live cursor labels ─────────────────────────────────────────────────
      CollaborationCursor.configure({
        provider,
        user: { name: userName, color: userColor },
      }),

      // ── Other extensions ───────────────────────────────────────────────────
      Placeholder.configure({ placeholder: 'Start writing…' }),
      TextStyle,
      FontSize,
      UnderlineExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],

    editorProps: {
      attributes: {
        class: 'tiptap',
      },
    },
  });

  return (
    <div className="relative flex">
      {/* Main editor area */}
      <div className="flex-1 min-w-0 ">
        {editor && !readOnly && <Toolbar editor={editor} />}

        {/* Floating bubble menu for quick inline formatting */}
        {editor && !readOnly && (
          //  duration is 100ms so that it appears only when the user selects the text 
          <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}> 
            {/* // here we make the tippy to appear only when the user selects the text */}
            <div className="flex items-center gap-1 bg-gray-900 rounded-lg px-2 py-1 shadow-xl">
              {[
                { icon: <Bold size={14} />, label: 'Bold', name: 'bold' as const },
                { icon: <Italic size={14} />, label: 'Italic', name: 'italic' as const },
                { icon: <Underline size={14} />, label: 'Underline', name: 'underline' as const },
                { icon: <Code size={14} />, label: 'Code', name: 'code' as const },
              ].map(({ icon, label, name }) => (
                <button
                  key={name}
                  title={label}
                  onClick={() => editor.chain().focus().toggleMark(name).run()}
                  className={clsx(
                    'p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700 transition-colors',
                    editor.isActive(name) && 'text-white bg-gray-700'
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </BubbleMenu>
        )}

        <div className="bg-surface min-h-[70vh]">
          <EditorContent editor={editor} />
        </div>

        {/* Slash command menu */}
        {editor && !readOnly && <SlashCommandMenu editor={editor} />}
      </div>

      {/* Presence sidebar */}
      {presenceSidebarOpen && awarenessUsers.size > 0 && (
        <ResizableSidebar
          initialWidth={210}
          minWidth={170}
          maxWidth={320}
          className="pl-4 pt-4 pb-4 pr-3 border-l border-line bg-surface"
          side="left"
        >
          <div className="flex items-center justify-between mb-3 pr-1">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-ink-subtle" />
              <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">
                Editing now
              </p>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                {awarenessUsers.size}
              </span>
            </div>
            <button
              onClick={() => useUIStore.getState().setPresenceSidebarOpen(false)}
              aria-label="Close presence panel"
              className="p-1 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-muted transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-1.5">
            {Array.from(awarenessUsers.values()).map((u, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-muted animate-fade-in transition-colors"
              >
                <span className="relative inline-flex flex-shrink-0">
                  <Avatar name={u.name} color={u.color} size="sm" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-surface" />
                </span>
                <span className="text-sm text-ink-muted truncate">{u.name}</span>
              </div>
            ))}
          </div>
        </ResizableSidebar>
      )}
    </div>
  );
}
