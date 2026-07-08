import React from 'react';
import { cn } from '@/lib/utils';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  size?: InputSize;
}

const sizeStyles: Record<InputSize, string> = {
  sm: 'h-8 px-2.5 text-b3 gap-1.5',
  md: 'h-10 px-3 text-b2 gap-2',
  lg: 'h-12 px-4 text-b1 gap-2.5',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, prefix, suffix, size = 'md', className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-kb-xs">
        {label && (
          <label htmlFor={inputId} className="text-b2 font-medium text-text-primary">
            {label}
          </label>
        )}

        <div
          className={cn(
            'flex items-center rounded-kb-md',
            'bg-bg-secondary border',
            'transition-all duration-kb-fast ease-kb-default',
            'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200/50',
            error
              ? 'border-[#F43F5E]/60 focus-within:border-[#F43F5E] focus-within:ring-rose-200/50'
              : 'border-border/70',
            sizeStyles[size],
            className,
          )}
        >
          {prefix && <span className="text-text-tertiary flex-shrink-0">{prefix}</span>}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              'flex-1 bg-transparent outline-none',
              'text-text-primary placeholder:text-text-tertiary',
              'min-w-0',
            )}
            {...props}
          />

          {suffix && <span className="text-text-tertiary flex-shrink-0">{suffix}</span>}
        </div>

        {error && (
          <p className="text-c1 text-[#F43F5E]">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
