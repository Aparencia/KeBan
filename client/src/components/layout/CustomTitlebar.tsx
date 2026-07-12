import { useState, useEffect } from 'react';
import { Minus, Square, Maximize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomTitlebarProps {
  className?: string;
}

export function CustomTitlebar({ className }: CustomTitlebarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // 初始化最大化状态
    window.electronAPI?.windowIsMaximized().then(setIsMaximized);

    // 监听最大化状态变化
    const cleanup = window.electronAPI?.onMaximizedChanged(setIsMaximized);
    return cleanup;
  }, []);

  const handleMinimize = () => window.electronAPI?.windowMinimize();
  const handleMaximize = () => window.electronAPI?.windowMaximize();
  const handleClose = () => window.electronAPI?.windowClose();

  return (
    <div
      className={cn(
        'flex items-center h-8 select-none bg-bg-secondary border-b border-border',
        className,
      )}
    >
      {/* 左侧：Logo + 标题（拖拽区域） */}
      <div className="window-drag-region flex items-center gap-kb-sm pl-kb-sm h-full flex-1">
        <img src="/favicon.svg" alt="" className="w-4 h-4" />
        <span className="text-c1 text-text-secondary font-medium">课伴</span>
      </div>

      {/* 右侧：窗口控制按钮（no-drag） */}
      <div className="flex" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          className="w-11 h-8 flex items-center justify-center hover:bg-bg-tertiary transition-colors duration-kb-fast"
          aria-label="最小化"
        >
          <Minus className="w-icon-xs h-icon-xs text-text-secondary" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-11 h-8 flex items-center justify-center hover:bg-bg-tertiary transition-colors duration-kb-fast"
          aria-label={isMaximized ? '还原' : '最大化'}
        >
          {isMaximized ? (
            <Square className="w-3 h-3 text-text-secondary" />
          ) : (
            <Maximize2 className="w-icon-xs h-icon-xs text-text-secondary" />
          )}
        </button>
        <button
          onClick={handleClose}
          className="w-11 h-8 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors duration-kb-fast"
          aria-label="关闭"
        >
          <X className="w-icon-xs h-icon-xs" />
        </button>
      </div>
    </div>
  );
}
