import React from 'react';
import { cn } from '@/lib/utils';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  lines?: number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  lines = 1,
  className,
}) => {
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
              'bg-bg-tertiary/60 animate-pulse rounded-kb-sm',
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
        className={cn('bg-bg-tertiary/60 animate-pulse rounded-kb-full', className)}
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
      className={cn('bg-bg-tertiary/60 animate-pulse rounded-kb-md', className)}
      style={{
        width: style.width || '100%',
        height: style.height || '120px',
      }}
    />
  );
};

Skeleton.displayName = 'Skeleton';
