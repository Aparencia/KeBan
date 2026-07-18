/**
 * 功能覆盖层 — 当用户进入模块时，在3D场景上方显示功能UI
 * 使用毛玻璃面板，保持3D场景在背后可见
 */
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FunctionalOverlayProps {
  children: React.ReactNode;
  className?: string;
}

export function FunctionalOverlay({ children, className }: FunctionalOverlayProps) {
  return (
    <motion.div
      className={cn(
        "fixed inset-0 z-10 flex items-center justify-center p-8",
        "pointer-events-none", // 背景区域不拦截事件
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* 半透明背景遮罩 */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto" />

      {/* 功能面板 */}
      <motion.div
        className={cn(
          "relative z-10 w-full max-w-5xl max-h-[85vh] overflow-y-auto",
          "rounded-[24px_12px_20px_16px]", // 不对称圆角
          "bg-white/10 dark:bg-black/30",
          "backdrop-blur-2xl",
          "border border-white/20 dark:border-white/10",
          "shadow-[0_8px_40px_rgba(0,0,0,0.3)]",
          "pointer-events-auto", // 面板区域可交互
          "p-8"
        )}
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
