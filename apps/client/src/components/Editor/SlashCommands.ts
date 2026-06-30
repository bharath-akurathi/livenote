/**
 * Slash Commands — Tiptap extension for "/" quick formatting menu
 *
 * When the user types "/" at the start of a new line, a floating menu appears
 * with block-level formatting options. Pressing Enter or clicking selects.
 */
import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/react';

export interface SlashCommand {
  title: string;
  description: string;
  icon: string;
  command: (editor: Editor) => void;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    title: 'Heading 1',
    description: 'Big section heading',
    icon: 'H1',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list',
    icon: '•',
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Create a numbered list',
    icon: '1.',
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: 'Blockquote',
    description: 'Capture a quote',
    icon: '"',
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: 'Code Block',
    description: 'Add a code snippet',
    icon: '</>',
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: 'Horizontal Rule',
    description: 'Visual divider',
    icon: '—',
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
];
