import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * 页面过渡动画
 *
 * 性能优化：仅使用 opacity + transform（scale / translateY），
 * 全部命中 GPU composite 层，不触发 paint/layout 重算。
 * （旧版 filter: blur(4px) 会强制 paint，已在 v0.9.0 移除）
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
          duration: 0.35,
          ease: [0.25, 0.1, 0.25, 1],
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
