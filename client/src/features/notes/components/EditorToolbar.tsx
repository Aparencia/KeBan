import { useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Highlighter, Heading1, Heading2, Heading3, List, ListOrdered,
  Code, Quote, Undo2, Redo2,
  Table2, ListTodo, ImageIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolbarButtonProps {
  icon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

export function ToolbarButton({ icon: Icon, label, isActive, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        'p-kb-sm rounded-kb-sm transition-all duration-kb-fast',
        isActive
          ? 'bg-brand-50 text-brand-600'
          : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
        'active:bg-bg-secondary active:scale-95',
      )}
    >
      <Icon className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border/50 mx-1" />;
}

interface EditorToolbarProps {
  editor: Editor | null;
}

export default function EditorToolbar({ editor }: EditorToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      editor.chain().focus().setImage({ src: base64 }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [editor]);

  return (
    <>
      <div className="flex items-center gap-1 px-kb-md py-2 border-b border-border/40 flex-shrink-0 overflow-x-auto">
        <ToolbarButton icon={Undo2} label="撤销" onClick={() => editor?.chain().focus().undo().run()} />
        <ToolbarButton icon={Redo2} label="重做" onClick={() => editor?.chain().focus().redo().run()} />
        <ToolbarDivider />
        <ToolbarButton icon={Heading1} label="标题 1" isActive={editor?.isActive('heading', { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} />
        <ToolbarButton icon={Heading2} label="标题 2" isActive={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolbarButton icon={Heading3} label="标题 3" isActive={editor?.isActive('heading', { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} />
        <ToolbarDivider />
        <ToolbarButton icon={Bold} label="加粗" isActive={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()} />
        <ToolbarButton icon={Italic} label="斜体" isActive={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()} />
        <ToolbarButton icon={UnderlineIcon} label="下划线" isActive={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
        <ToolbarButton icon={Strikethrough} label="删除线" isActive={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()} />
        <ToolbarButton icon={Highlighter} label="高亮" isActive={editor?.isActive('highlight')} onClick={() => editor?.chain().focus().toggleHighlight().run()} />
        <ToolbarDivider />
        <ToolbarButton icon={List} label="无序列表" isActive={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
        <ToolbarButton icon={ListOrdered} label="有序列表" isActive={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
        <ToolbarButton icon={Quote} label="引用" isActive={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
        <ToolbarButton icon={Code} label="代码块" isActive={editor?.isActive('codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()} />
        <ToolbarDivider />
        <ToolbarButton icon={Table2} label="插入表格" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
        <ToolbarButton icon={ListTodo} label="任务列表" isActive={editor?.isActive('taskList')} onClick={() => editor?.chain().focus().toggleTaskList().run()} />
        <ToolbarButton icon={ImageIcon} label="插入图片" onClick={() => imageInputRef.current?.click()} />
        <ToolbarDivider />
        <ToolbarButton icon={AlignLeft} label="左对齐" isActive={editor?.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()} />
        <ToolbarButton icon={AlignCenter} label="居中" isActive={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()} />
        <ToolbarButton icon={AlignRight} label="右对齐" isActive={editor?.isActive({ textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()} />
        <ToolbarButton icon={AlignJustify} label="两端对齐" isActive={editor?.isActive({ textAlign: 'justify' })} onClick={() => editor?.chain().focus().setTextAlign('justify').run()} />
        <ToolbarDivider />
        <label title="文字颜色" className="relative p-kb-sm rounded-kb-sm cursor-pointer text-text-secondary hover:bg-bg-tertiary hover:text-text-primary active:bg-bg-secondary active:scale-95 transition-all duration-kb-fast">
          <Palette className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
          <input type="color" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()} />
        </label>
      </div>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
    </>
  );
}
