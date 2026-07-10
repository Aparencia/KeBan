import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-brand-600 text-white',
    'hover:bg-brand-700 hover:shadow-md hover:shadow-brand-600/20',
    'active:bg-brand-800 active:scale-95 active:ease-kb-bounce',
    'shadow-kb-sm',
  ].join(' '),
  secondary: [
    'bg-bg-tertiary text-text-primary',
    'hover:bg-border hover:shadow-md',
    'active:bg-border-strong active:scale-95 active:ease-kb-bounce',
    'border border-white/10',
  ].join(' '),
  ghost: [
    'bg-transparent text-text-secondary',
    'hover:bg-bg-tertiary hover:text-text-primary',
    'active:bg-bg-secondary active:scale-95 active:ease-kb-bounce',
  ].join(' '),
  danger: [
    'bg-[#F43F5E] text-white',
    'hover:bg-rose-700 hover:shadow-md hover:shadow-rose-600/20',
    'active:bg-rose-800 active:scale-95 active:ease-kb-bounce',
    'shadow-kb-sm',
  ].join(' '),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-b3 rounded-kb-sm gap-1.5',
  md: 'px-4 py-2 text-b2 rounded-kb-md gap-2',
  lg: 'px-6 py-3 text-b1 rounded-kb-lg gap-2.5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      icon,
      iconRight,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          // Base
          'inline-flex items-center justify-center font-medium',
          'transition-all duration-kb-fast ease-kb-smooth',
          'select-none whitespace-nowrap',
          // Variant
          variantStyles[variant],
          // Size
          sizeStyles[size],
          // Disabled
          isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          // Hover scale (only when not disabled)
          !isDisabled && 'hover:scale-[1.02]',
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-icon-sm h-icon-sm animate-spin" />
        ) : (
          icon
        )}
        {children}
        {iconRight && !loading && iconRight}
      </button>
    );
  },
);

Button.displayName = 'Button';
