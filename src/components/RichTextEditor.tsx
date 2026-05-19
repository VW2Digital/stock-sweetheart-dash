import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { useEffect, useCallback } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Link as LinkIcon, Undo, Redo, Pilcrow, Minus, Unlink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const ToolbarButton = ({
  onClick, active, disabled, title, children,
}: { onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      'h-8 w-8 inline-flex items-center justify-center rounded text-sm transition-colors',
      'hover:bg-muted text-foreground',
      active && 'bg-muted text-primary',
      disabled && 'opacity-40 cursor-not-allowed',
    )}
  >
    {children}
  </button>
);

const Divider = () => <span className="w-px h-5 bg-border mx-1" />;

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes('link').href;
    const url = window.prompt('URL do link', previous || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/40 rounded-t-md sticky top-0 z-10">
      <ToolbarButton title="Desfazer" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Refazer" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo className="h-4 w-4" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title="Parágrafo" onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')}>
        <Pilcrow className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Título 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Título 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Título 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title="Negrito" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Itálico" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Sublinhado" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Tachado" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title="Lista" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Lista numerada" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Citação" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Código" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')}>
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Linha horizontal" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="h-4 w-4" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title="Adicionar link" onClick={setLink} active={editor.isActive('link')}>
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Remover link" onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive('link')}>
        <Unlink className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: 'text-primary underline' } }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[320px] px-4 py-3 focus:outline-none',
        'data-placeholder': placeholder || '',
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="border border-border rounded-md bg-background overflow-hidden">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
