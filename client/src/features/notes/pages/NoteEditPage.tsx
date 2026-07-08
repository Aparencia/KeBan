import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import {
  ArrowLeft, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Highlighter, Heading1, Heading2, Heading3, List, ListOrdered,
  Code, Quote, Undo2, Redo2, Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNoteStore } from '../store/useNoteStore';

interface ToolbarButtonProps {
  icon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

function ToolbarButton({ icon: Icon, label, isActive, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        'p-2 rounded-kb-sm transition-all duration-kb-fast',
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

export default function NoteEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const noteId = id ? Number(id) : null;

  const { notes, updateNote, selectNote, loadNotes } = useNoteStore();
  const note = notes.find((n) => n.id === noteId) || null;

  const titleRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 解析初始内容
  const initialContent = useMemo(() => {
    if (!note?.content) return undefined;
    try {
      const parsed = JSON.parse(note.content);
      if (parsed && parsed.type === 'doc') return parsed;
      return undefined;
    } catch {
      return undefined;
    }
  // 只在 note.id 变化时重新计算
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  // debounce 保存函数
  const debouncedSave = useCallback(
    (content: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (noteId) {
          updateNote(noteId, { content });
        }
      }, 500);
    },
    [noteId, updateNote],
  );

  // 清理 debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: '开始记录你的笔记...' }),
    ],
    content: initialContent,
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON();
      const contentStr = JSON.stringify(json);
      debouncedSave(contentStr);
    },
  });

  // 加载笔记数据
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // 选中当前笔记
  useEffect(() => {
    if (noteId) selectNote(noteId);
  }, [noteId, selectNote]);

  // 标题保存
  const handleTitleBlur = () => {
    if (noteId && titleRef.current) {
      const newTitle = titleRef.current.value.trim();
      if (newTitle && newTitle !== note?.title) {
        updateNote(noteId, { title: newTitle });
      }
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleRef.current?.blur();
    }
  };

  if (!note) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-kb-md text-center">
          <h3 className="text-h2 font-medium text-text-primary">笔记不存在</h3>
          <p className="text-b2 text-text-tertiary">该笔记可能已被删除</p>
          <button
            onClick={() => navigate('/notes')}
            className="mt-2 text-brand-600 hover:text-brand-700 text-b2 font-medium"
          >
            返回笔记列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* 顶部栏 */}
      <div className="flex items-center gap-kb-sm px-kb-md py-3 border-b border-border/50 flex-shrink-0">
        <button
          onClick={() => navigate('/notes')}
          className="p-1.5 rounded-kb-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-kb-fast"
          aria-label="返回"
        >
          <ArrowLeft className="w-icon-md h-icon-md" strokeWidth={1.5} />
        </button>

        <input
          ref={titleRef}
          defaultValue={note.title}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          placeholder="输入笔记标题..."
          className={cn(
            'flex-1 bg-transparent outline-none text-h2 font-semibold text-text-primary',
            'placeholder:text-text-tertiary/60',
          )}
        />

        <button
          onClick={() => {
            if (editor) {
              const content = JSON.stringify(editor.getJSON());
              updateNote(noteId!, { content, title: titleRef.current?.value || note.title });
            }
          }}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-kb-md text-b2 font-medium',
            'bg-bg-secondary text-text-secondary border border-border/50',
            'hover:bg-bg-tertiary hover:text-text-primary',
            'active:scale-95 transition-all duration-kb-fast',
          )}
        >
          <Save className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
          保存
        </button>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-kb-md py-2 border-b border-border/40 flex-shrink-0 overflow-x-auto">
        <ToolbarButton icon={Undo2} label="撤销" onClick={() => editor?.chain().focus().undo().run()} />
        <ToolbarButton icon={Redo2} label="重做" onClick={() => editor?.chain().focus().redo().run()} />
        <ToolbarDivider />
        <ToolbarButton
          icon={Heading1}
          label="标题 1"
          isActive={editor?.isActive('heading', { level: 1 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          icon={Heading2}
          label="标题 2"
          isActive={editor?.isActive('heading', { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          icon={Heading3}
          label="标题 3"
          isActive={editor?.isActive('heading', { level: 3 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarDivider />
        <ToolbarButton
          icon={Bold}
          label="加粗"
          isActive={editor?.isActive('bold')}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={Italic}
          label="斜体"
          isActive={editor?.isActive('italic')}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={UnderlineIcon}
          label="下划线"
          isActive={editor?.isActive('underline')}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          icon={Strikethrough}
          label="删除线"
          isActive={editor?.isActive('strike')}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        />
        <ToolbarButton
          icon={Highlighter}
          label="高亮"
          isActive={editor?.isActive('highlight')}
          onClick={() => editor?.chain().focus().toggleHighlight().run()}
        />
        <ToolbarDivider />
        <ToolbarButton
          icon={List}
          label="无序列表"
          isActive={editor?.isActive('bulletList')}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="有序列表"
          isActive={editor?.isActive('orderedList')}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          icon={Quote}
          label="引用"
          isActive={editor?.isActive('blockquote')}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          icon={Code}
          label="代码块"
          isActive={editor?.isActive('codeBlock')}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        />
      </div>

      {/* 编辑区 */}
      <div className="flex-1 overflow-y-auto px-kb-md py-kb-lg">
        <div className="max-w-3xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
