import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  /** 'default': 标准入场动画; 'none': 无动画，直接渲染 */
  variant?: 'default' | 'none';
}

/**
 * 页面过渡动画
 *
 * 性能优化：仅使用 opacity + transform（scale / translateY），
 * 全部命中 GPU composite 层，不触发 paint/layout 重算。
 * （旧版 filter: blur(4px) 会强制 paint，已在 v0.9.0 移除）
 *
 * variant="none" 时跳过入场动画，用于主页等自身带有内部动画的页面。
 */
export function PageTransition({ children, className, variant = 'default' }: PageTransitionProps) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced || variant === 'none') {
    return <div className={cn("h-full", className)}>{children}</div>;
  }

  return (
    <motion.div
      className={cn("h-full", className)}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
          duration: 0.4,
          ease: [0.22, 0.61, 0.36, 1],
        },
      }}
      exit={{
        opacity: 0,
        y: -6,
        scale: 1.01,
        transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
      }}
    >
      {children}
    </motion.div>
  );
}
