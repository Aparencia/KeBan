import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TimerRingProps {
  totalSeconds: number;
  remainingSeconds: number;
  phase: 'work' | 'short_break' | 'long_break';
  isRunning: boolean;
}

const PHASE_COLORS: Record<string, string> = {
  work: '#F43F5E',
  short_break: '#06B6D4',
  long_break: '#2563EB',
};

const PHASE_LABELS: Record<string, string> = {
  work: '专注中',
  short_break: '短休息',
  long_break: '长休息',
};

export default function TimerRing({
  totalSeconds,
  remainingSeconds,
  phase,
  isRunning,
}: TimerRingProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const rafRef = useRef<number>(0);

  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const color = PHASE_COLORS[phase];
  const label = PHASE_LABELS[phase];
  const isLast10 = remainingSeconds <= 10 && remainingSeconds > 0 && isRunning;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  useEffect(() => {
    const animate = () => {
      const el = circleRef.current;
      if (!el) return;

      const size = window.innerWidth < 768 ? 200 : 240;
      const strokeWidth = 8;
      const r = (size - strokeWidth) / 2;
      const circumference = 2 * Math.PI * r;

      // Read current remaining from DOM for smooth interpolation
      const currentProgress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
      const offset = circumference * (1 - currentProgress);

      el.setAttribute('stroke-dasharray', String(circumference));
      el.setAttribute('stroke-dashoffset', String(offset));

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [remainingSeconds, totalSeconds]);

  const size = 240;
  const strokeWidth = 8;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - progress);

  return (
    <>
      <style>{`
        @keyframes kb-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        .kb-animate-pulse {
          animation: kb-pulse 1s ease-in-out infinite;
        }
      `}</style>

      <div className="relative inline-flex items-center justify-center">
        <svg
          className="w-[200px] h-[200px] md:w-[240px] md:h-[240px]"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background ring - very faint */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-border/30"
          />

          {/* Progress ring */}
          <circle
            ref={circleRef}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={strokeWidth}
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-kb-normal ease-kb-default"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: '50% 50%',
            }}
          />
        </svg>

        {/* Center content overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className={cn(
              'font-timer font-light tracking-tight leading-none',
              'transition-colors duration-kb-normal ease-kb-default',
              isLast10 && 'kb-animate-pulse',
            )}
            style={{
              fontSize: 'clamp(4rem, 8vw, 6rem)',
              color: isLast10 ? '#F43F5E' : undefined,
            }}
          >
            {timeStr}
          </span>
          <span
            className="text-b2 mt-kb-xs font-medium transition-colors duration-kb-normal"
            style={{ color }}
          >
            {label}
          </span>
        </div>
      </div>
    </>
  );
}
