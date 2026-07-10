import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/* ── 类型定义 ──────────────────────────────────────── */

export interface ContextMenuItem {
  /** 菜单项唯一标识，选中时传给 onSelect */
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  /** 二级子菜单分组，存在时该项显示 ▶ 指示器 */
  subGroups?: ContextMenuGroup[];
}

export interface ContextMenuGroup {
  /** 分组标题，可选 */
  label?: string;
  items: ContextMenuItem[];
}

export interface ContextMenuProps<C = unknown> {
  /** 菜单分组 */
  groups: ContextMenuGroup[];
  /** 菜单位置 */
  position: { x: number; y: number };
  /** 右键菜单上下文数据（触发时的目标对象） */
  context: C;
  /** 菜单项选中回调，接收 itemKey 和 context */
  onSelect: (itemKey: string, context: C) => void;
  /** 关闭菜单 */
  onClose: () => void;
}

/* ── 二级子菜单面板 ──────────────────────────────────── */
const SubMenuPanel: React.FC<{
  groups: ContextMenuGroup[];
  anchorRect: DOMRect;
  onClose: () => void;
  /** 根菜单的 onSelect，子菜单项点击后直接调用 */
  onSelectRoot: () => void;
  /** 鼠标进入子面板时通知父行取消关闭 */
  onHoverChange?: (hovering: boolean) => void;
}> = ({ groups, anchorRect, onClose, onSelectRoot, onHoverChange }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    let x = anchorRect.right + 2;
    let y = anchorRect.top;

    // 右侧空间不足则翻转到左侧
    if (x + rect.width > window.innerWidth) {
      x = anchorRect.left - rect.width - 2;
    }
    // 垂直方向边界修正
    if (y + rect.height > window.innerHeight) {
      y = window.innerHeight - rect.height - 8;
    }
    if (y < 0) y = 8;

    setPos({ x, y });
  }, [anchorRect]);

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      className={cn(
        'fixed z-[10000] bg-bg-elevated border border-border/50 rounded-kb-md shadow-lg py-1 min-w-[160px]',
        'animate-in fade-in duration-100',
      )}
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => { onHoverChange?.(false); onClose(); }}
    >
      {groups.map((group, gIdx) => (
        <React.Fragment key={gIdx}>
          {gIdx > 0 && (
            <div className="my-1 h-px bg-border/40" role="separator" />
          )}
          {group.label && (
            <div className="px-3 py-1 text-xs font-medium text-text-tertiary select-none">
              {group.label}
            </div>
          )}
          {group.items.map((item) => (
            <MenuItemRow key={item.key} item={item} onSelectRoot={onSelectRoot} />
          ))}
        </React.Fragment>
      ))}
    </div>,
    document.body,
  );
};

/* ── 单行菜单项（支持子菜单递归） ──────────────────── */
const MenuItemRow: React.FC<{
  item: ContextMenuItem;
  /** 调用此函数表示叶子项被选中，应关闭整个菜单 */
  onSelectRoot: () => void;
}> = ({ item, onSelectRoot }) => {
  const [subOpen, setSubOpen] = useState(false);
  const rowRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  const hasSub = item.subGroups && item.subGroups.length > 0;

  const handleMouseEnter = useCallback(() => {
    if (!hasSub) return;
    clearTimeout(closeTimer.current);
    setSubOpen(true);
  }, [hasSub]);

  const handleMouseLeave = useCallback(() => {
    if (!hasSub) return;
    closeTimer.current = setTimeout(() => setSubOpen(false), 150);
  }, [hasSub]);

  /** 子面板 hover 回调：鼠标在子面板上时取消关闭定时器 */
  const handleSubHoverChange = useCallback((hovering: boolean) => {
    if (hovering) {
      clearTimeout(closeTimer.current);
    }
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={rowRef}
        role="menuitem"
        disabled={item.disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (hasSub) return; // 有子菜单时不触发选中
          onSelectRoot();
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
        <span className="flex-1">{item.label}</span>
        {hasSub && (
          <span className="ml-auto text-text-tertiary text-xs">▶</span>
        )}
      </button>

      {subOpen && hasSub && rowRef.current && (
        <SubMenuPanel
          groups={item.subGroups!}
          anchorRect={rowRef.current.getBoundingClientRect()}
          onClose={() => setSubOpen(false)}
          onSelectRoot={onSelectRoot}
          onHoverChange={handleSubHoverChange}
        />
      )}
    </div>
  );
};

/* ── 主菜单组件 ────────────────────────────────────── */
export const ContextMenu = <C,>({
  groups,
  position,
  context,
  onSelect,
  onClose,
}: ContextMenuProps<C>) => {
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

  /** 叶子项选中：先调用 onSelect 再关闭菜单 */
  const handleSelectRoot = useCallback(
    (itemKey: string) => {
      onSelect(itemKey, context);
      onClose();
    },
    [onSelect, context, onClose],
  );

  /** 递归渲染：传递正确的 onSelectRoot（叶子项点击 → 关闭整个菜单） */
  const renderGroups = (groups: ContextMenuGroup[]) =>
    groups.map((group, gIdx) => (
      <React.Fragment key={gIdx}>
        {gIdx > 0 && (
          <div className="my-1 h-px bg-border/40" role="separator" />
        )}
        {group.label && (
          <div className="px-3 py-1 text-xs font-medium text-text-tertiary select-none">
            {group.label}
          </div>
        )}
        {group.items.map((item) => (
          <MenuItemRow
            key={item.key}
            item={item}
            onSelectRoot={() => handleSelectRoot(item.key)}
          />
        ))}
      </React.Fragment>
    ));

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
      {renderGroups(groups)}
    </div>,
    document.body,
  );
};
