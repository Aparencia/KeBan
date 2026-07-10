import type React from 'react';
import { cn } from '@/lib/utils';

/** Shimmer 骨架公共样式：脉动 + 光泽扫过 */
const shimmerClasses = cn(
  'bg-bg-tertiary rounded-kb-md overflow-hidden relative',
  'before:content-[\'\'] before:absolute before:inset-0',
  'before:bg-gradient-to-r before:from-transparent before:via-bg-secondary/50 before:to-transparent',
  'before:animate-shimmer before:bg-[length:200%_100%]',
  'animate-pulse-skeleton',
);

export type SkeletonVariant = 'text' | 'circular' | 'rectangular';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  lines?: number;
  className?: string;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  lines = 1,
  className,
}: SkeletonProps) {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  if (variant === 'text') {
    return (
      <div className="flex flex-col gap-kb-xs">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              shimmerClasses,
              'rounded-kb-sm',
              i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full',
              className,
            )}
            style={{ height: height ? style.height : '0.875rem' }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'circular') {
    return (
      <div
        className={cn(shimmerClasses, 'rounded-kb-full', className)}
        style={{
          width: style.width || '40px',
          height: style.height || style.width || '40px',
        }}
      />
    );
  }

  // rectangular
  return (
    <div
      className={cn(shimmerClasses, className)}
      style={{
        width: style.width || '100%',
        height: style.height || '120px',
      }}
    />
  );
}

Skeleton.displayName = 'Skeleton';
