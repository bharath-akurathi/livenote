/**
 * SlashCommandMenu — floating UI rendered when user types "/" in the editor.
 * Uses React portal to position near the cursor.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { SLASH_COMMANDS, type SlashCommand } from './SlashCommands';
import type { Editor } from '@tiptap/react';

interface Props {
  editor: Editor;
}

export function SlashCommandMenu({ editor }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description.toLowerCase().includes(query.toLowerCase())
  );

  // Listen for "/" keystroke and menu navigation
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // When menu is open, handle navigation
      if (open) {
        if (event.key === 'Escape') {
          setOpen(false);
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedIndex((i) => (i + 1) % filtered.length);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          if (filtered[selectedIndex]) {
            selectCommand(filtered[selectedIndex]);
          }
          return;
        }
        if (event.key === 'Backspace') {
          if (query === '') {
            setOpen(false);
          } else {
            setQuery((q) => q.slice(0, -1));
            setSelectedIndex(0);
          }
          return;
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          setQuery((q) => q + event.key);
          setSelectedIndex(0);
        }
        return;
      }

      // When menu is closed, detect "/"
      if (event.key === '/' && !open) {
        if (!editor.isFocused) return;
        const { state } = editor.view;
        const { $from } = state.selection;
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');

        if (textBefore.trim() === '') {
          const domSelection = window.getSelection();
          if (domSelection && domSelection.rangeCount > 0) {
            const range = domSelection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setCoords({
              top: rect.bottom + window.scrollY + 4,
              left: rect.left + window.scrollX,
            });
          }
          setOpen(true);
          setQuery('');
          setSelectedIndex(0);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor, open, query, filtered, selectedIndex]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectCommand = useCallback(
    (cmd: SlashCommand) => {
      // Delete the "/" character and any query text
      const { state } = editor.view;
      const { $from } = state.selection;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
      const slashPos = textBefore.lastIndexOf('/');
      if (slashPos >= 0) {
        const from = $from.start() + slashPos;
        const to = $from.pos;
        editor.chain().focus().deleteRange({ from, to }).run();
      }
      cmd.command(editor);
      setOpen(false);
    },
    [editor]
  );

  if (!open || filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="slash-menu fixed z-50"
      style={{ top: coords.top, left: coords.left }}
    >
      {filtered.map((cmd, i) => (
        <div
          key={cmd.title}
          className={`slash-menu-item ${i === selectedIndex ? 'is-selected' : ''}`}
          onClick={() => selectCommand(cmd)}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <div className="slash-menu-item-icon font-mono text-xs font-bold">
            {cmd.icon}
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm dark:text-ink">{cmd.title}</p>
            <p className="text-gray-500 text-xs dark:text-ink-muted">{cmd.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
