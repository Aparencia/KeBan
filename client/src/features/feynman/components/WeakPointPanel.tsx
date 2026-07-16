import { motion } from 'framer-motion';
import { X, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import type { FeynmanWeakPoint } from '@/types/models';
import { cn } from '@/lib/utils';

interface WeakPointPanelProps {
  noteId: string | null;
  weakPoints: FeynmanWeakPoint[];
  onClose: () => void;
  onToggleMastered: (noteId: string, weakPointId: string) => void;
  onRemove: (noteId: string, weakPointId: string) => void;
}

/**
 * 薄弱点列表面板（步骤 3 右侧抽屉）。
 * 支持标记掌握、删除操作，带入场动画。
 */
export function WeakPointPanel({
  noteId,
  weakPoints,
  onClose,
  onToggleMastered,
  onRemove,
}: WeakPointPanelProps) {
  return (
    <motion.aside
      className={cn(
        'w-72 flex-shrink-0 border-l border-border/50 bg-bg-secondary/80 backdrop-blur-xl',
        'shadow-[-8px_0_24px_rgba(0,0,0,0.12)]',
        'overflow-y-auto hidden md:block',
      )}
      initial={{ opacity: 0, x: 24, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 16, scale: 0.97 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const }}
    >
      <div className="p-kb-md">
        <div className="flex items-center justify-between mb-kb-md">
          <h3 className="text-b1 font-semibold text-text-primary">薄弱点列表</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-kb-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-kb-fast"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
        {weakPoints.length === 0 ? (
          <p className="text-b2 text-text-tertiary text-center py-4">
            选中讲解文本即可标记薄弱点
          </p>
        ) : (
          <div className="space-y-2.5">
            {weakPoints.map((wp, i) => (
              <motion.div
                key={wp.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
                className={cn(
                  'flex gap-2.5 p-3 rounded-kb-md',
                  'bg-bg-elevated border border-border/40',
                  'group',
                )}
              >
                <button
                  onClick={() => noteId && wp.id && onToggleMastered(noteId, wp.id)}
                  className="flex-shrink-0 mt-0.5"
                  title={wp.mastered ? '标记为未掌握' : '标记为已掌握'}
                >
                  {wp.mastered ? (
                    <CheckCircle2 className="w-5 h-5 text-semantic-success" strokeWidth={1.5} />
                  ) : (
                    <Circle className="w-5 h-5 text-text-tertiary" strokeWidth={1.5} />
                  )}
                </button>
                <p className={cn(
                  'text-b3 leading-relaxed flex-1',
                  wp.mastered ? 'text-text-tertiary line-through' : 'text-text-secondary',
                )}>
                  {wp.text}
                </p>
                <button
                  onClick={() => noteId && wp.id && onRemove(noteId, wp.id)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-text-tertiary hover:text-semantic-error transition-all duration-kb-fast"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.aside>
  );
}
