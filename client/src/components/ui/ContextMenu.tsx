import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ items, position, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState(position);

  // 边界检测：菜单超出视口时调整位置
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let { x, y } = position;

    if (x + rect.width > window.innerWidth) {
      x = window.innerWidth - rect.width - 8;
    }
    if (y + rect.height > window.innerHeight) {
      y = window.innerHeight - rect.height - 8;
    }
    if (x < 0) x = 8;
    if (y < 0) y = 8;

    setAdjustedPos({ x, y });
  }, [position]);

  // 点击外部或 Escape 关闭
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    // 使用 setTimeout 避免当前 contextmenu 事件立即触发关闭
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className={cn(
        'fixed z-[9999] bg-bg-elevated border border-border/50 rounded-kb-md shadow-lg py-1 min-w-[160px]',
        'animate-in fade-in duration-100',
      )}
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, idx) => (
        <button
          key={idx}
          role="menuitem"
          disabled={item.disabled}
          onClick={(e) => {
            e.stopPropagation();
            item.onClick();
            onClose();
          }}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-b2 text-left transition-colors',
            item.danger
              ? 'text-semantic-error hover:bg-semantic-error/10'
              : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
            item.disabled && 'opacity-40 cursor-not-allowed',
          )}
        >
          {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
};
