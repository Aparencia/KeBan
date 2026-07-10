import { useRef, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { X, GripVertical } from 'lucide-react';
import type { FreeCanvasBlock } from '@/types/models';

interface FreeTextBlockProps {
  block: FreeCanvasBlock;
  onMove: (id: string, x: number, y: number) => void;
  onContentChange: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onResize: (id: string, width: number, height: number) => void;
}

export default function FreeTextBlock({
  block,
  onMove,
  onContentChange,
  onDelete,
  onResize,
}: FreeTextBlockProps) {
  const onMoveRef = useRef(onMove);
  const onContentChangeRef = useRef(onContentChange);
  const onResizeRef = useRef(onResize);
  onMoveRef.current = onMove;
  onContentChangeRef.current = onContentChange;
  onResizeRef.current = onResize;

  // 解析初始内容（TipTap JSON）
  const initialContent = (() => {
    if (!block.content) return undefined;
    try {
      const parsed = JSON.parse(block.content);
      if (parsed && parsed.type === 'doc') return parsed;
      return undefined;
    } catch {
      return undefined;
    }
  })();

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON();
      onContentChangeRef.current(block.id, JSON.stringify(json));
    },
  });

  // 拖拽移动逻辑
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const origX = block.position.x;
      const origY = block.position.y;

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        onMoveRef.current(block.id, origX + dx, origY + dy);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [block.id, block.position.x, block.position.y],
  );

  // 调整大小逻辑
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const origW = block.size.width;
      const origH = typeof block.size.height === 'number' ? block.size.height : 120;

      const handleMouseMove = (ev: MouseEvent) => {
        const newW = Math.max(120, origW + (ev.clientX - startX));
        const newH = Math.max(60, origH + (ev.clientY - startY));
        onResizeRef.current(block.id, newW, newH);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [block.id, block.size.width, block.size.height],
  );

  // 清理编辑器
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blockHeight = typeof block.size.height === 'number' ? block.size.height : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        left: block.position.x,
        top: block.position.y,
        width: block.size.width,
        height: blockHeight,
      }}
      className="bg-bg-elevated border border-border/50 rounded-kb-md shadow-sm overflow-hidden flex flex-col"
    >
      {/* 拖拽手柄栏 */}
      <div
        className="flex items-center h-7 px-1.5 bg-bg-tertiary/60 border-b border-border/40 flex-shrink-0 cursor-grab select-none"
        onMouseDown={handleDragStart}
      >
        <GripVertical className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" strokeWidth={1.5} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(block.id);
          }}
          className="p-0.5 rounded-kb-sm text-text-tertiary hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
          title="删除"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {/* TipTap 编辑区域 */}
      <div className="flex-1 overflow-y-auto p-2 text-sm">
        <EditorContent editor={editor} />
      </div>

      {/* 右下角调整大小手柄 */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize select-none"
        style={{
          background:
            'linear-gradient(135deg, transparent 50%, rgba(156,163,175,0.5) 50%, rgba(156,163,175,0.5) 60%, transparent 60%, transparent 75%, rgba(156,163,175,0.5) 75%, rgba(156,163,175,0.5) 85%, transparent 85%)',
        }}
      />
    </div>
  );
}
