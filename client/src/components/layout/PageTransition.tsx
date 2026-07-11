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
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.25, ease: [0, 0, 0.2, 1] },
      }}
      exit={{
        opacity: 0,
        y: -4,
        transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
      }}
    >
      {children}
    </motion.div>
  );
}
