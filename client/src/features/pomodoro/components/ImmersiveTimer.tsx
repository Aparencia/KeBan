/**
 * ImmersiveTimer — 沉浸模式大圆环计时器
 *
 * 全屏深色背景居中 SVG 渐变光环，
 * 进度环 + 呼吸光晕 + 等宽大字号倒计时。
 */
import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Pause, Play } from 'lucide-react';
import { usePomodoroStore } from '../store/usePomodoroStore';
import { useShallow } from 'zustand/react/shallow';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const SIZE = 240;
const STROKE_WIDTH = 10;
const R = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/* 呼吸光晕半径（比进度环大） */
const HALO_R = R + 18;

const PHASE_LABELS: Record<string, string> = {
  work: '专注中',
  short_break: '休息中',
  long_break: '休息中',
};

export default function ImmersiveTimer() {
  const progressRef = useRef<SVGCircleElement>(null);
  const rafRef = useRef<number>(0);
  const prefersReduced = useReducedMotion();

  const {
    remainingSeconds,
    totalSeconds,
    phase,
    isRunning,
    completedCount,
    settings,
    pause,
    resume,
  } = usePomodoroStore(useShallow(s => s));

  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const label = PHASE_LABELS[phase] ?? '专注中';

  useEffect(() => {
    const animate = () => {
      const el = progressRef.current;
      if (!el) return;
      const currentProgress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
      const offset = CIRCUMFERENCE * (1 - currentProgress);
      el.setAttribute('stroke-dasharray', String(CIRCUMFERENCE));
      el.setAttribute('stroke-dashoffset', String(offset));
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [remainingSeconds, totalSeconds]);

  return (
    <div
      className="flex flex-col items-center justify-center gap-8 select-none border-none outline-none ring-0 shadow-none"
    >
      {/* SVG 圆环 */}
      <div className="relative inline-flex items-center justify-center border-none outline-none">
        {/* 呼吸光晕层（CSS animation） */}
        {!prefersReduced && (
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: '160%',
              height: '160%',
              left: '-30%',
              top: '-30%',
              background: 'radial-gradient(circle, rgba(79,176,255,0.10) 0%, transparent 70%)',
              animation: isRunning
                ? 'halo-breathe 4s ease-in-out infinite'
                : undefined,
              opacity: isRunning ? undefined : 0.3,
              transform: isRunning ? undefined : 'scale(1)',
            }}
          />
        )}

        <svg
          className="w-[60vw] h-[60vw] max-w-[420px] max-h-[420px]"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          overflow="visible"
        >
          <defs>
            {/* 品牌渐变：#FF7F50 → #4FB0FF */}
            <linearGradient id="immersiveGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FF7F50" />
              <stop offset="100%" stopColor="#4FB0FF" />
            </linearGradient>
            {/* 发光滤镜 */}
            <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 呼吸光晕圆（SVG 层） */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={HALO_R}
            fill="none"
            stroke="url(#immersiveGradient)"
            strokeWidth={2}
            opacity={0.15}
            style={
              !prefersReduced && isRunning
                ? { animation: 'halo-breathe 4s ease-in-out infinite' }
                : undefined
            }
          />

          {/* 背景底圈 */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={STROKE_WIDTH}
          />

          {/* 进度圆环 */}
          <circle
            ref={progressRef}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="url(#immersiveGradient)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            filter="url(#glowFilter)"
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: '50% 50%',
            }}
          />
        </svg>

        {/* 圆环内倒计时 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className={cn(
              'font-timer font-light tracking-tight leading-none',
              'text-white/90',
            )}
            style={{
              fontSize: 'clamp(4rem, 10vw, 7rem)',
              textShadow: '0 0 24px rgba(79,176,255,0.35), 0 0 48px rgba(79,176,255,0.12)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {timeStr}
          </span>
          <span
            className="text-b2 mt-2 font-medium tracking-widest uppercase"
            style={{ color: 'rgba(79,176,255,0.7)' }}
          >
            {label}
          </span>
        </div>
      </div>

      {/* 底部极简信息栏：番茄计数点 + 暂停按钮 */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          {Array.from({ length: settings.longBreakInterval }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                i < completedCount
                  ? 'bg-[#FF7F50] shadow-[0_0_8px_rgba(255,127,80,0.6)]'
                  : 'bg-white/15',
              )}
            />
          ))}
        </div>
        <button
          onClick={isRunning ? pause : resume}
          className={cn(
            'p-2.5 rounded-full transition-all duration-200',
            'text-white/40 hover:text-white/80 hover:bg-white/10',
          )}
        >
          {isRunning
            ? <Pause className="w-5 h-5" strokeWidth={1.5} />
            : <Play className="w-5 h-5" strokeWidth={1.5} />}
        </button>
      </div>
    </div>
  );
}
