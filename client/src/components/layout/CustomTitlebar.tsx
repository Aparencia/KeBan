import { useState, useEffect, useCallback } from 'react';
import { Minus, Square, Maximize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 自定义标题栏组件属性
 * @param className - 可选的额外 CSS 类名，用于外部覆盖样式
 */
interface CustomTitlebarProps {
  className?: string;
}

/**
 * 自定义标题栏组件 — frameless 窗口顶部栏
 *
 * @ai-context
 * - Electron BrowserWindow `frame: false` 模式下替代系统标题栏
 * - 拖拽区域必须使用 CSS 类 `.drag-region`（禁止内联 style）
 * - 交互元素必须使用 CSS 类 `.no-drag`（禁止内联 style）
 * - 双击拖拽区域触发最大化/还原
 * - 深海静谧主题：深色背景 + 微妙边框 + 品牌渐变 Logo
 *
 * @param props - 组件属性
 * @returns 自定义标题栏 JSX 元素
 */
export function CustomTitlebar({ className }: CustomTitlebarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // 初始化时查询当前最大化状态
    window.electronAPI?.windowIsMaximized().then(setIsMaximized);
    // 监听主进程发出的最大化状态变化事件
    const cleanup = window.electronAPI?.onMaximizedChanged(setIsMaximized);
    return cleanup;
  }, []);

  /** 最小化窗口 */
  const handleMinimize = useCallback(() => {
    window.electronAPI?.windowMinimize();
  }, []);

  /** 切换最大化/还原 */
  const handleMaximize = useCallback(() => {
    window.electronAPI?.windowMaximize();
  }, []);

  /** 关闭窗口（触发确认对话框） */
  const handleClose = useCallback(() => {
    window.electronAPI?.windowClose();
  }, []);

  return (
    <div
      className={cn(
        'drag-region flex items-center h-9 select-none',
        'bg-[#0f1f3a] border-b border-[#1e3456]',
        className,
      )}
    >
      {/* 左侧：品牌 Logo + 应用名称（拖拽区域，双击最大化） */}
      <div className="flex items-center gap-2 pl-3 h-full" onDoubleClick={handleMaximize}>
        {/* 品牌 Logo — 深海青渐变圆角方块 + 内圈弧线 */}
        <div className="w-4 h-4 rounded-[4px] bg-gradient-to-br from-brand-400 to-brand-600 relative flex-shrink-0 shadow-[0_0_8px_rgba(91,138,114,0.3)]">
          <div className="absolute top-[3px] left-[3px] w-2.5 h-2.5 border border-white/50 rounded-full" />
        </div>
        <span className="text-xs font-medium text-[#e8edf5] tracking-wide">
          课伴
        </span>
      </div>

      {/* 中间弹性占位 — 双击最大化 */}
      <div className="flex-1" onDoubleClick={handleMaximize} />

      {/* 右侧：窗口控制按钮（禁止拖拽） */}
      <div className="no-drag flex h-full">
        <button
          onClick={handleMinimize}
          className="w-11 h-9 flex items-center justify-center text-[#e8edf5]/60 hover:text-[#818cf8] hover:bg-white/5 transition-all duration-200 active:scale-90"
          aria-label="最小化"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-11 h-9 flex items-center justify-center text-[#e8edf5]/60 hover:text-[#818cf8] hover:bg-white/5 transition-all duration-200 active:scale-90"
          aria-label={isMaximized ? '还原' : '最大化'}
        >
          {isMaximized ? (
            <Square className="w-3 h-3" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          )}
        </button>
        <button
          onClick={handleClose}
          className="w-11 h-9 flex items-center justify-center text-[#e8edf5]/60 hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all duration-200 active:scale-90"
          aria-label="关闭"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
