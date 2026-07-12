import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8, scale: 0.98, filter: 'blur(4px)' }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: {
          duration: 0.35,
          ease: [0.25, 0.1, 0.25, 1],
        },
      }}
      exit={{
        opacity: 0,
        y: -4,
        scale: 1.01,
        filter: 'blur(2px)',
        transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
      }}
    >
      {children}
    </motion.div>
  );
}
