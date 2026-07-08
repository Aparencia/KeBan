import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-kb-md',
        'transition-all duration-kb-normal',
      )}
    >
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative w-full',
          'bg-bg-elevated rounded-kb-xl shadow-kb-lg',
          'border border-border/40',
          'p-kb-lg',
          'animate-modal-enter',
          sizeStyles[size],
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className={cn(
            'absolute top-4 right-4',
            'p-1.5 rounded-kb-full',
            'text-text-tertiary hover:text-text-primary',
            'hover:bg-bg-tertiary',
            'transition-all duration-kb-fast',
          )}
          aria-label="关闭"
        >
          <X className="w-icon-md h-icon-md" />
        </button>

        {/* Header */}
        <div className="pr-8">
          <h2 className="text-h2 font-semibold text-text-primary">{title}</h2>
          {description && (
            <p className="mt-kb-xs text-b2 text-text-secondary">{description}</p>
          )}
        </div>

        {/* Body */}
        <div className="mt-kb-md">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="mt-kb-lg flex justify-end gap-kb-sm">{footer}</div>
        )}
      </div>

      <style>{`
        @keyframes modal-enter {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-enter {
          animation: modal-enter var(--kb-duration-normal) var(--kb-ease-out) forwards;
        }
      `}</style>
    </div>
  );
};

Modal.displayName = 'Modal';
