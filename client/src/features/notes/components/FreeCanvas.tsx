import { useCallback } from 'react';
import { Plus } from 'lucide-react';
import FreeTextBlock from './FreeTextBlock';
import type { FreeCanvasData, FreeCanvasBlock } from '@/types/models';

interface FreeCanvasProps {
  content: FreeCanvasData | null;
  onChange: (data: FreeCanvasData) => void;
}

const DEFAULT_CANVAS_WIDTH = 2000;
const DEFAULT_CANVAS_HEIGHT = 2000;

function buildDefaultData(): FreeCanvasData {
  return {
    blocks: [],
    canvasWidth: DEFAULT_CANVAS_WIDTH,
    canvasHeight: DEFAULT_CANVAS_HEIGHT,
  };
}

export default function FreeCanvas({ content, onChange }: FreeCanvasProps) {
  const data: FreeCanvasData = content ?? buildDefaultData();

  const emitChange = useCallback(
    (next: FreeCanvasData) => {
      onChange(next);
    },
    [onChange],
  );

  // 添加新文本块
  const handleAddBlock = useCallback(() => {
    const newBlock: FreeCanvasBlock = {
      id: crypto.randomUUID(),
      type: 'text',
      content: '',
      position: {
        x: data.canvasWidth / 2 - 140 + Math.random() * 40 - 20,
        y: data.canvasHeight / 2 - 80 + Math.random() * 40 - 20,
      },
      size: { width: 280, height: 160 },
    };
    emitChange({ ...data, blocks: [...data.blocks, newBlock] });
  }, [data, emitChange]);

  // 移动块
  const handleMove = useCallback(
    (id: string, x: number, y: number) => {
      emitChange({
        ...data,
        blocks: data.blocks.map((b) =>
          b.id === id ? { ...b, position: { x, y } } : b,
        ),
      });
    },
    [data, emitChange],
  );

  // 内容变更
  const handleContentChange = useCallback(
    (id: string, blockContent: string) => {
      emitChange({
        ...data,
        blocks: data.blocks.map((b) =>
          b.id === id ? { ...b, content: blockContent } : b,
        ),
      });
    },
    [data, emitChange],
  );

  // 删除块
  const handleDelete = useCallback(
    (id: string) => {
      emitChange({
        ...data,
        blocks: data.blocks.filter((b) => b.id !== id),
      });
    },
    [data, emitChange],
  );

  // 调整大小
  const handleResize = useCallback(
    (id: string, width: number, height: number) => {
      emitChange({
        ...data,
        blocks: data.blocks.map((b) =>
          b.id === id ? { ...b, size: { width, height } } : b,
        ),
      });
    },
    [data, emitChange],
  );

  return (
    <div className="flex flex-col h-full">
      {/* 画布滚动区域 */}
      <div className="flex-1 overflow-auto relative">
        <div
          style={{
            position: 'relative',
            width: data.canvasWidth,
            height: data.canvasHeight,
            backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          {data.blocks.map((block) => (
            <FreeTextBlock
              key={block.id}
              block={block}
              onMove={handleMove}
              onContentChange={handleContentChange}
              onDelete={handleDelete}
              onResize={handleResize}
            />
          ))}
        </div>
      </div>

      {/* 底部固定操作栏 */}
      <div className="flex-shrink-0 border-t border-border/40 bg-bg-elevated px-4 py-2 flex items-center justify-center">
        <button
          type="button"
          onClick={handleAddBlock}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-kb-md text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 active:scale-95 transition-all duration-kb-fast"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          添加文本块
        </button>
      </div>
    </div>
  );
}
