import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, MessageSquare, Highlighter, RefreshCw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4;
  completedSteps: number[];
}

const steps = [
  { num: 1 as const, label: '选择概念', icon: BookOpen, desc: '确定学习主题' },
  { num: 2 as const, label: '讲解概念', icon: MessageSquare, desc: '用简单语言解释' },
  { num: 3 as const, label: '标注薄弱', icon: Highlighter, desc: '找出说不清的部分' },
  { num: 4 as const, label: '简化重述', icon: RefreshCw, desc: '用更通俗的话重讲' },
];

/** SVG ring radius / circumference constants */
const RING_SIZE = 40;
const RING_RADIUS = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function StepRing({
  step,
  completed,
  current,
  prefersReduced,
}: {
  step: number;
  completed: boolean;
  current: boolean;
  prefersReduced: boolean;
}) {
  const progress = completed ? 1 : current ? 0.5 : 0;
  const offset = RING_CIRCUMFERENCE * (1 - progress);
  const StepIcon = steps[step - 1].icon;

  return (
    <div className="relative flex items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
      {/* Glow pulse behind current step */}
      {current && !completed && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--kb-brand-500) 0%, transparent 70%)',
            opacity: 0.35,
          }}
          animate={prefersReduced ? {} : {
            scale: [1, 1.45, 1],
            opacity: [0.25, 0.45, 0.25],
          }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Completed checkmark burst */}
      {completed && (
        <motion.div
          className="absolute inset-0 rounded-full bg-semantic-success/20"
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 1.3, opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}

      {/* SVG ring */}
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        className="absolute inset-0"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background track */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={3}
          className={cn(
            'transition-colors duration-kb-normal',
            completed ? 'stroke-semantic-success/30' : 'stroke-border',
          )}
        />
        {/* Progress arc */}
        <motion.circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            completed ? 'stroke-semantic-success' : 'stroke-brand-500',
          )}
        />
      </svg>

      {/* Center icon / check */}
      <motion.div
        className={cn(
          'relative z-10 flex items-center justify-center w-7 h-7 rounded-full',
          'transition-colors duration-kb-normal',
          completed && 'bg-semantic-success text-white',
          current && !completed && 'bg-brand-500/15 text-brand-600',
          !completed && !current && 'bg-bg-elevated text-text-tertiary',
        )}
        initial={false}
        animate={current && !completed && !prefersReduced ? {
          scale: [1, 1.08, 1],
        } : {}}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {completed ? (
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
          </motion.div>
        ) : (
          <StepIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
        )}
      </motion.div>
    </div>
  );
}

export function StepIndicator({ currentStep, completedSteps }: StepIndicatorProps) {
  const prefersReduced = useReducedMotion();
  const isCompleted = (n: number) => completedSteps.includes(n);
  const isCurrent = (n: number) => currentStep === n;
  const progressFraction = `${currentStep} / ${steps.length}`;

  return (
    <>
      {/* Desktop horizontal layout */}
      <div className="hidden md:flex flex-col gap-2 w-full">
        {/* Progress fraction */}
        <div className="flex items-center justify-between px-1">
          <span className="text-c1 text-text-tertiary">学习进度</span>
          <motion.span
            key={currentStep}
            className="text-c1 font-semibold text-feynman"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {progressFraction}
          </motion.span>
        </div>

        {/* Steps row */}
        <div className="flex items-center w-full">
          {steps.map(({ num, label }, idx) => {
            const completed = isCompleted(num);
            const current = isCurrent(num);
            const isLast = idx === steps.length - 1;

            return (
              <div key={num} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <StepRing
                    step={num}
                    completed={completed}
                    current={current}
                    prefersReduced={prefersReduced}
                  />
                  <motion.span
                    className={cn(
                      'text-c1 whitespace-nowrap transition-colors duration-kb-fast',
                      completed && 'text-semantic-success font-medium',
                      current && !completed && 'text-brand-600 font-medium',
                      !completed && !current && 'text-text-tertiary',
                    )}
                    initial={false}
                    animate={current ? { scale: 1.05 } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {label}
                  </motion.span>
                </div>

                {/* Connecting line */}
                {!isLast && (
                  <div className="flex-1 mx-2 relative h-1">
                    {/* Track */}
                    <div className="absolute inset-0 rounded-full bg-border/60" />
                    {/* Fill */}
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        background: isCompleted(num)
                          ? 'linear-gradient(90deg, var(--kb-color-success), var(--kb-color-success))'
                          : current
                            ? 'linear-gradient(90deg, var(--kb-brand-500), var(--kb-brand-300))'
                            : 'transparent',
                      }}
                      initial={false}
                      animate={{
                        width: isCompleted(num) ? '100%' : current ? '50%' : '0%',
                      }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile vertical layout */}
      <div className="flex md:hidden flex-col gap-1">
        {/* Compact progress bar */}
        <div className="flex items-center gap-2 mb-1 px-1">
          <div className="flex-1 h-1.5 rounded-full bg-border/60 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-feynman"
              initial={false}
              animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="text-c1 font-medium text-feynman tabular-nums">{progressFraction}</span>
        </div>

        {/* Steps */}
        {steps.map(({ num, label, desc }, idx) => {
          const completed = isCompleted(num);
          const current = isCurrent(num);
          const isLast = idx === steps.length - 1;

          return (
            <div key={num} className="relative">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <StepRing
                    step={num}
                    completed={completed}
                    current={current}
                    prefersReduced={prefersReduced}
                  />
                  {!isLast && (
                    <motion.div
                      className="w-0.5 rounded-full mt-1"
                      style={{ height: 16 }}
                      initial={false}
                      animate={{
                        backgroundColor: completed
                          ? 'var(--kb-color-success)'
                          : 'var(--kb-border-default)',
                      }}
                      transition={{ duration: 0.4 }}
                    />
                  )}
                </div>
                <div className="flex flex-col pb-1">
                  <span className={cn(
                    'text-b3 font-medium',
                    completed && 'text-semantic-success',
                    current && !completed && 'text-brand-600',
                    !completed && !current && 'text-text-tertiary',
                  )}>
                    {label}
                  </span>
                  {current && (
                    <motion.span
                      className="text-c1 text-text-tertiary"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.3 }}
                    >
                      {desc}
                    </motion.span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
