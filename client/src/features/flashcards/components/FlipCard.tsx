import { cn } from '@/lib/utils';

interface FlipCardProps {
  front: string;
  back: string;
  isFlipped: boolean;
  onFlip: () => void;
  /** 翻转动效完成后回调（用于触发评分按钮 stagger 入场） */
  onFlipEnd?: () => void;
  /** 卡片正在执行退出动画 */
  exiting?: boolean;
}

export function FlipCard({ front, back, isFlipped, onFlip, onFlipEnd, exiting }: FlipCardProps) {
  return (
    <div
      className={cn(
        'w-full cursor-pointer select-none',
        exiting && 'animate-card-exit',
      )}
      style={{ perspective: '1200px' }}
      onClick={onFlip}
      role="button"
      tabIndex={0}
      aria-label={isFlipped ? '显示正面' : '显示背面'}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFlip(); } }}
    >
      <div
        className="relative w-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: `transform 450ms var(--kb-ease-spring)`,
          willChange: 'transform',
          minHeight: '200px',
        }}
        onTransitionEnd={(e) => {
          // 仅在翻转 transition 结束时触发（排除退出动画）
          if (e.propertyName === 'transform' && !exiting) {
            onFlipEnd?.();
          }
        }}
      >
        {/* 正面 */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center p-kb-xl',
            'bg-bg-elevated rounded-kb-xl border border-border/50 shadow-kb-md',
            'backdrop-blur-sm',
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex flex-col items-center gap-kb-sm text-center">
            <p className="text-[1.25rem] font-semibold text-text-primary leading-relaxed">{front}</p>
            <p className="text-c1 text-text-tertiary">点击翻转查看答案</p>
          </div>
        </div>

        {/* 背面 */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center p-kb-xl',
            'bg-brand-50/60 rounded-kb-xl border border-brand-200/40 shadow-kb-md',
          )}
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <p className="text-[1.05rem] text-text-secondary leading-relaxed text-center">{back}</p>
        </div>
      </div>
    </div>
  );
}
