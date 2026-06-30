import { type Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline, Strikethrough, Code, Code2,
  Heading1, Heading2, Heading3, List, ListOrdered,
  Quote, Minus, Link2, Link, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, Highlighter, Undo2, Redo2,
} from 'lucide-react';
import { clsx } from 'clsx';

interface Props { editor: Editor }

interface ToolbarButton {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function Btn({ icon, label, active, disabled, onClick }: ToolbarButton) {
  return (
    <button
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'p-1.5 rounded-md transition-all duration-100',
        active ? 'bg-brand-100 text-brand-700 shadow-sm' : 'hover:bg-gray-100 text-gray-600',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
    >
      {icon}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-gray-200 mx-1" />;
}

export function Toolbar({ editor }: Props) {
  const sz = 16;

  const setLink = () => {
    const url = window.prompt('Enter URL');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className="flex items-center flex-wrap gap-0.5 px-3 py-2 border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
      {/* History */}
      <Btn icon={<Undo2 size={sz} />} label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()} />
      <Btn icon={<Redo2 size={sz} />} label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()} />
      <Sep />

      {/* Font Size */}
      <select
        className="text-sm border border-gray-200 rounded-md py-1 px-2 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
        onChange={(e) => {
          if (e.target.value === 'default') {
            editor.chain().focus().unsetFontSize().run();
          } else {
            editor.chain().focus().setFontSize(e.target.value).run();
          }
        }}
        value={editor.getAttributes('textStyle').fontSize || 'default'}
      >
        <option value="default">Normal</option>
        <option value="12px">12px</option>
        <option value="14px">14px</option>
        <option value="16px">16px</option>
        <option value="18px">18px</option>
        <option value="20px">20px</option>
        <option value="24px">24px</option>
        <option value="30px">30px</option>
      </select>
      <Sep />

      {/* Headings */}
      <Btn icon={<Heading1 size={sz} />} label="Heading 1"
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
      <Btn icon={<Heading2 size={sz} />} label="Heading 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
      <Btn icon={<Heading3 size={sz} />} label="Heading 3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
      <Sep />

      {/* Inline marks */}
      <Btn icon={<Bold size={sz} />} label="Bold (⌘B)"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()} />
      <Btn icon={<Italic size={sz} />} label="Italic (⌘I)"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()} />
      <Btn icon={<Underline size={sz} />} label="Underline (⌘U)"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <Btn icon={<Strikethrough size={sz} />} label="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()} />
      <Btn icon={<Code size={sz} />} label="Inline code"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()} />
      <Btn icon={<Highlighter size={sz} />} label="Highlight"
        active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()} />
      <Sep />

      {/* Lists */}
      <Btn icon={<List size={sz} />} label="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <Btn icon={<ListOrdered size={sz} />} label="Ordered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <Btn icon={<Quote size={sz} />} label="Blockquote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <Btn icon={<Code2 size={sz} />} label="Code block"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
      <Sep />

      {/* Alignment */}
      <Btn icon={<AlignLeft size={sz} />} label="Align left"
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()} />
      <Btn icon={<AlignCenter size={sz} />} label="Align center"
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()} />
      <Btn icon={<AlignRight size={sz} />} label="Align right"
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()} />
      <Btn icon={<AlignJustify size={sz} />} label="Justify"
        active={editor.isActive({ textAlign: 'justify' })}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()} />
      <Sep />

      {/* Misc */}
      <Btn icon={<Link2 size={sz} />} label="Link"
        active={editor.isActive('link')}
        onClick={setLink} />
      <Btn icon={<Minus size={sz} />} label="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()} />
    </div>
  );
}
