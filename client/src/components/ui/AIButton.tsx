/**
 * AI 功能按钮
 *
 * 本地模式下 disabled + Tooltip 提示，
 * 可用模式下渐变样式 + Sparkles 图标前缀。
 */
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ButtonProps } from '@/components/ui/Button';
import { useModeState } from '@/hooks/useMode';
import { cn } from '@/lib/utils';

export interface AIButtonProps extends ButtonProps {
  /** 禁用时 hover 显示的提示文案 */
  tooltip?: string;
}

export function AIButton({ tooltip, children, disabled, className, ...props }: AIButtonProps) {
  const { config } = useModeState();
  const isDisabled = disabled || !config.aiEnabled;

  return (
    <div className="relative group inline-flex">
      <Button
        variant="ai"
        disabled={isDisabled}
        icon={<Sparkles className="w-icon-sm h-icon-sm" />}
        className={cn(className)}
        {...props}
      >
        {children}
      </Button>
      {isDisabled && tooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-bg-tertiary text-text-secondary text-b3 rounded-kb-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {tooltip}
        </span>
      )}
    </div>
  );
}
