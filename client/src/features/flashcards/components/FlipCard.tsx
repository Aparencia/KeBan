import { cn } from '@/lib/utils';

interface FlipCardProps {
  front: string;
  back: string;
  isFlipped: boolean;
  onFlip: () => void;
}

export function FlipCard({ front, back, isFlipped, onFlip }: FlipCardProps) {
  return (
    <div
      className="w-full cursor-pointer select-none"
      style={{ perspective: '1000px' }}
      onClick={onFlip}
      role="button"
      tabIndex={0}
      aria-label={isFlipped ? '显示正面' : '显示背面'}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFlip(); } }}
    >
      <div
        className="relative w-full transition-transform duration-300 ease-in-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          minHeight: '200px',
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
