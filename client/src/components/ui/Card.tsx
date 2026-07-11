import React from 'react';
import { cn } from '@/lib/utils';

export type CardVariant = 'default' | 'elevated' | 'outlined';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hoverable?: boolean;
  padding?: CardPadding;
}

const variantStyles: Record<CardVariant, string> = {
  default: [
    'bg-bg-elevated rounded-kb-lg shadow-kb-sm',
    'border border-border/60',
    'hover:shadow-kb-md',
  ].join(' '),
  elevated: [
    'bg-bg-elevated rounded-kb-lg shadow-kb-md',
    'border border-white/5',
    'hover:shadow-lg hover:border-white/10',
  ].join(' '),
  outlined: [
    'bg-transparent rounded-kb-lg',
    'border border-border',
    'hover:border-border-strong hover:shadow-kb-sm',
  ].join(' '),
};

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-kb-sm',
  md: 'p-kb-md',
  lg: 'p-kb-lg',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', hoverable = false, padding = 'md', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'transition-all duration-kb-normal ease-kb-smooth',
          variantStyles[variant],
          paddingStyles[padding],
          hoverable && [
            'cursor-pointer',
            'hover:-translate-y-0.5 hover:shadow-lg',
            'hover:border-brand-200/50',
          ],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';
