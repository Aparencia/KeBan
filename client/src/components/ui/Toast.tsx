import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
  exiting?: boolean;
}

interface ToastContextValue {
  toast: (options: { type: ToastType; message: string; duration?: number }) => void;
}

// Context
const ToastContext = createContext<ToastContextValue | null>(null);

// Hook
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// Config per type
const typeConfig: Record<
  ToastType,
  { icon: React.FC<{ className?: string }>; color: string; bg: string }
> = {
  success: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500' },
  error: { icon: XCircle, color: 'text-[#F43F5E]', bg: 'bg-[#F43F5E]' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500' },
  info: { icon: Info, color: 'text-brand-500', bg: 'bg-brand-500' },
};

// ToastItem component
const ToastItemCard: React.FC<{ item: ToastItem }> = ({ item }) => {
  const { icon: Icon, color, bg } = typeConfig[item.type];

  return (
    <div
      className={cn(
        'flex items-center gap-kb-sm px-kb-md py-kb-sm',
        'bg-bg-elevated/90 backdrop-blur-md rounded-kb-md shadow-kb-lg',
        'border border-border/40',
        'min-w-[260px] max-w-sm',
        'transition-all duration-kb-normal ease-kb-out',
        item.exiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0',
      )}
    >
      {/* Left color bar */}
      <div className={cn('w-1 h-8 rounded-kb-full flex-shrink-0', bg)} />
      {/* Icon */}
      <Icon className={cn('w-icon-md h-icon-md flex-shrink-0', color)} />
      {/* Message */}
      <span className="text-b2 text-text-primary flex-1">{item.message}</span>
    </div>
  );
};

// Provider
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback(({ type, message, duration = 3000 }: { type: ToastType; message: string; duration?: number }) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    if (latest.exiting) return;

    const exitTimer = setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === latest.id ? { ...t, exiting: true } : t)),
      );
    }, latest.duration);

    const removeTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== latest.id));
    }, latest.duration + 300);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-kb-sm items-center">
        {toasts.map((t) => (
          <ToastItemCard key={t.id} item={t} />
        ))}
      </div>

      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

ToastProvider.displayName = 'ToastProvider';
