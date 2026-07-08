import { BookOpen, MessageSquare, Highlighter, RefreshCw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4;
  completedSteps: number[];
}

const steps = [
  { num: 1 as const, label: '选择概念', icon: BookOpen },
  { num: 2 as const, label: '讲解概念', icon: MessageSquare },
  { num: 3 as const, label: '标注薄弱', icon: Highlighter },
  { num: 4 as const, label: '简化重述', icon: RefreshCw },
];

export function StepIndicator({ currentStep, completedSteps }: StepIndicatorProps) {
  const isCompleted = (n: number) => completedSteps.includes(n);
  const isCurrent = (n: number) => currentStep === n;

  return (
    <>
      {/* 桌面横向 */}
      <div className="hidden md:flex items-center w-full">
        {steps.map(({ num, label, icon: Icon }, idx) => {
          const completed = isCompleted(num);
          const current = isCurrent(num);
          const isLast = idx === steps.length - 1;

          return (
            <div key={num} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                {/* 圆圈 */}
                <div className={cn(
                  'w-9 h-9 rounded-kb-full flex items-center justify-center',
                  'border-2 transition-all duration-kb-normal',
                  completed && 'bg-semantic-success border-semantic-success text-white',
                  current && !completed && 'bg-brand-600 border-brand-600 text-white shadow-kb-sm',
                  !completed && !current && 'border-border bg-bg-elevated text-text-tertiary',
                )}>
                  {completed ? (
                    <Check className="w-4 h-4" strokeWidth={2} />
                  ) : (
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </div>
                <span className={cn(
                  'text-c1 whitespace-nowrap',
                  completed && 'text-semantic-success font-medium',
                  current && !completed && 'text-brand-600 font-medium',
                  !completed && !current && 'text-text-tertiary',
                )}>
                  {label}
                </span>
              </div>
              {/* 连线 */}
              {!isLast && (
                <div className={cn(
                  'flex-1 h-0.5 mx-2 rounded-full transition-all duration-kb-normal',
                  isCompleted(num) ? 'bg-semantic-success' : 'bg-border',
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* 移动纵向 */}
      <div className="flex md:hidden flex-col gap-2">
        {steps.map(({ num, label, icon: Icon }, idx) => {
          const completed = isCompleted(num);
          const current = isCurrent(num);
          const isLast = idx === steps.length - 1;

          return (
            <div key={num} className="flex items-center gap-3">
              <div className={cn(
                'w-8 h-8 rounded-kb-full flex items-center justify-center flex-shrink-0',
                'border-2 transition-all duration-kb-normal',
                completed && 'bg-semantic-success border-semantic-success text-white',
                current && !completed && 'bg-brand-600 border-brand-600 text-white',
                !completed && !current && 'border-border bg-bg-elevated text-text-tertiary',
              )}>
                {completed ? (
                  <Check className="w-3.5 h-3.5" strokeWidth={2} />
                ) : (
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                )}
              </div>
              <span className={cn(
                'text-b2',
                completed && 'text-semantic-success font-medium',
                current && !completed && 'text-brand-600 font-medium',
                !completed && !current && 'text-text-tertiary',
              )}>
                {label}
              </span>
              {!isLast && (
                <div className={cn(
                  'absolute left-[15px] w-0.5 h-4 mt-1 rounded-full',
                  completed ? 'bg-semantic-success' : 'bg-border',
                )} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
