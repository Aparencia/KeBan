import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConflictDialogProps {
  open: boolean;
  conflict: {
    entityType: string;
    entityId: string;
    localData: string;
    remoteData: string;
  } | null;
  onResolve: (resolution: 'local' | 'remote' | 'manual') => void;
  onCancel: () => void;
}

const entityTypeLabels: Record<string, string> = {
  note: '笔记',
  deck: '卡组',
  card: '闪卡',
  session: '学习记录',
  default: '实体',
};

function getEntityLabel(type: string): string {
  return entityTypeLabels[type] ?? entityTypeLabels.default;
}

/**
 * 冲突解决对话框
 * 当同步检测到本地与远程数据冲突时显示
 */
export default function ConflictDialog({ open, conflict, onResolve, onCancel }: ConflictDialogProps) {
  if (!open || !conflict) return null;

  const entityLabel = getEntityLabel(conflict.entityType);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className={cn(
          'relative w-full max-w-2xl mx-kb-md',
          'bg-bg-primary border border-border/40 rounded-kb-lg shadow-2xl',
          'flex flex-col gap-kb-md p-kb-lg',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-h4 font-semibold text-text-primary">
            解决同步冲突
          </h2>
          <button
            onClick={onCancel}
            className={cn(
              'p-kb-xs rounded-kb-md',
              'text-text-tertiary hover:text-text-primary',
              'hover:bg-bg-secondary transition-colors',
            )}
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict info */}
        <p className="text-body-sm text-text-secondary">
          <span className="font-medium text-text-primary">{entityLabel}</span>
          {' '}在本地和远程存在冲突，请选择保留哪个版本。
        </p>

        {/* Diff view */}
        <div className="grid grid-cols-2 gap-kb-md">
          {/* Local version */}
          <div className="flex flex-col gap-kb-xs">
            <span className="text-caption font-medium text-text-tertiary uppercase tracking-wide">
              本地版本
            </span>
            <div className={cn(
              'flex-1 overflow-y-auto max-h-64 p-kb-md rounded-kb-md',
              'bg-bg-secondary border border-border/30',
              'text-body-sm text-text-secondary font-mono whitespace-pre-wrap break-words',
            )}>
              {conflict.localData || '（无内容）'}
            </div>
          </div>

          {/* Remote version */}
          <div className="flex flex-col gap-kb-xs">
            <span className="text-caption font-medium text-text-tertiary uppercase tracking-wide">
              远程版本
            </span>
            <div className={cn(
              'flex-1 overflow-y-auto max-h-64 p-kb-md rounded-kb-md',
              'bg-bg-secondary border border-border/30',
              'text-body-sm text-text-secondary font-mono whitespace-pre-wrap break-words',
            )}>
              {conflict.remoteData || '（无内容）'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-kb-sm pt-kb-xs">
          <button
            onClick={() => onResolve('local')}
            className={cn(
              'px-kb-md py-kb-sm rounded-kb-md text-body-sm font-medium',
              'bg-bg-secondary text-text-primary',
              'border border-border/40',
              'hover:bg-bg-tertiary transition-colors',
            )}
          >
            保留本地版本
          </button>
          <button
            onClick={() => onResolve('remote')}
            className={cn(
              'px-kb-md py-kb-sm rounded-kb-md text-body-sm font-medium',
              'bg-bg-secondary text-text-primary',
              'border border-border/40',
              'hover:bg-bg-tertiary transition-colors',
            )}
          >
            使用远程版本
          </button>
          <button
            onClick={() => onResolve('manual')}
            className={cn(
              'px-kb-md py-kb-sm rounded-kb-md text-body-sm font-medium',
              'bg-accent-primary text-white',
              'hover:bg-accent-primary/90 transition-colors',
            )}
          >
            手动合并
          </button>
        </div>
      </div>
    </div>
  );
}
