import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, ArrowRight,
  LayoutDashboard, Timer, FileText, Layers, Lightbulb, BarChart3, Settings,
  FilePlus, FolderPlus, Import, Download, Moon, CheckCircle,
  Palette, Brain, Database, Info,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { commandRegistry } from '@/lib/commandPalette/registry';
import { registerDefaultCommands } from '@/lib/commandPalette/defaultCommands';
import type { Command } from '@/lib/commandPalette/registry';

// ─── 图标名称 → 组件映射 ─────────────────────────────────────────────────────
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, Timer, FileText, Layers, Lightbulb, BarChart3, Settings,
  FilePlus, FolderPlus, Import, Download, Moon, CheckCircle,
  Palette, Brain, Database, Info,
};

function CommandIcon({ name, className }: { name?: string; className?: string }) {
  if (!name || !iconMap[name]) return null;
  const Icon = iconMap[name];
  return <Icon className={className} />;
}

// ─── Category 标签 ─────────────────────────────────────────────────────────────
const categoryLabels: Record<Command['category'], string> = {
  navigation: '导航',
  action: '操作',
  settings: '设置',
};

const categoryColors: Record<Command['category'], string> = {
  navigation: 'bg-blue-500/15 text-blue-500',
  action: 'bg-emerald-500/15 text-emerald-500',
  settings: 'bg-violet-500/15 text-violet-500',
};

// ─── 分组辅助 ─────────────────────────────────────────────────────────────────
function groupByCategory(commands: Command[]): Array<{ category: Command['category']; items: Command[] }> {
  const order: Command['category'][] = ['navigation', 'action', 'settings'];
  const groups = new Map<Command['category'], Command[]>();
  for (const cmd of commands) {
    const list = groups.get(cmd.category) ?? [];
    list.push(cmd);
    groups.set(cmd.category, list);
  }
  return order.filter((c) => groups.has(c)).map((category) => ({ category, items: groups.get(category)! }));
}

// ─── 主组件 ────────────────────────────────────────────────────────────────────
export default function CommandPalette() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const registeredRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 注册默认命令（仅首次挂载）
  useEffect(() => {
    if (!registeredRef.current) {
      registerDefaultCommands(navigate, toast);
      registeredRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 搜索结果
  const filtered = useMemo(() => commandRegistry.search(query), [query]);
  const groups = useMemo(() => (query ? null : groupByCategory(filtered)), [query, filtered]);
  const flatList = filtered; // 用于键盘导航的统一列表

  // Ctrl+K / Cmd+K 监听
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // 面板打开后聚焦输入框
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // 选中项自动滚动到可视区
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // 关闭面板
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  // 执行命令
  const executeCommand = useCallback(
    async (cmd: Command) => {
      close();
      try {
        await cmd.execute();
      } catch (err) {
        toast({ type: 'error', message: `命令执行失败：${err instanceof Error ? err.message : '未知错误'}` });
      }
    },
    [close, toast],
  );

  // 键盘交互（面板内部）
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (flatList.length === 0 ? 0 : Math.min(i + 1, flatList.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatList[selectedIndex]) {
          executeCommand(flatList[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    },
    [flatList, selectedIndex, executeCommand, close],
  );

  // 查找命令在 flatList 中的索引
  const getFlatIndex = useCallback(
    (cmd: Command) => flatList.findIndex((c) => c.id === cmd.id),
    [flatList],
  );

  if (!isOpen) return null;

  return (
    // 遮罩层
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={close}
    >
      {/* 面板卡片 */}
      <div
        className={cn(
          'bg-bg-elevated rounded-kb-xl shadow-2xl',
          'w-[560px] max-h-[400px] flex flex-col',
          'border border-border/40',
          'animate-modal-enter',
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* 搜索输入框 */}
        <div className="px-kb-md pt-kb-md pb-kb-sm">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="输入命令或搜索功能…"
            size="lg"
            prefix={<Search className="w-4 h-4" />}
            suffix={
              query ? (
                <button
                  onClick={() => { setQuery(''); setSelectedIndex(0); inputRef.current?.focus(); }}
                  className="text-text-tertiary hover:text-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="text-c1 text-text-tertiary bg-bg-secondary px-1.5 py-0.5 rounded border border-border/50">
                  ESC
                </kbd>
              )
            }
            className="!bg-bg-secondary"
          />
        </div>

        {/* 命令列表 */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-kb-sm pb-kb-md">
          {flatList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Search className="w-8 h-8 text-text-tertiary" />
              <p className="text-b2 text-text-tertiary">未找到匹配命令</p>
            </div>
          ) : groups ? (
            // 无搜索时按分类分组显示
            groups.map((group) => (
              <div key={group.category} className="mb-kb-sm">
                <div className="px-kb-sm py-1">
                  <span className="text-c1 font-medium text-text-tertiary uppercase tracking-wider">
                    {categoryLabels[group.category]}
                  </span>
                </div>
                {group.items.map((cmd) => {
                  const flatIdx = getFlatIndex(cmd);
                  const isSelected = flatIdx === selectedIndex;
                  return (
                    <CommandItem
                      key={cmd.id}
                      cmd={cmd}
                      index={flatIdx}
                      isSelected={isSelected}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(flatIdx)}
                    />
                  );
                })}
              </div>
            ))
          ) : (
            // 搜索时平铺显示
            flatList.map((cmd, idx) => (
              <CommandItem
                key={cmd.id}
                cmd={cmd}
                index={idx}
                isSelected={idx === selectedIndex}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(idx)}
              />
            ))
          )}
        </div>

        {/* 底部快捷键提示 */}
        <div className="flex items-center gap-3 px-kb-md py-kb-xs border-t border-border/30">
          <FooterHint keys="↑↓" label="导航" />
          <FooterHint keys="↵" label="执行" />
          <FooterHint keys="esc" label="关闭" />
        </div>
      </div>
    </div>
  );
}

// ─── 命令项 ────────────────────────────────────────────────────────────────────
function CommandItem({
  cmd, index, isSelected, onClick, onMouseEnter,
}: {
  cmd: Command;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      data-index={index}
      className={cn(
        'w-full flex items-center gap-kb-sm px-kb-sm py-2 rounded-kb-md transition-colors',
        isSelected
          ? 'bg-brand-500/10 text-text-primary'
          : 'text-text-secondary hover:bg-bg-secondary',
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {/* 图标 */}
      <div className={cn(
        'flex items-center justify-center w-8 h-8 rounded-kb-md flex-shrink-0',
        isSelected ? 'bg-brand-500/20 text-brand-500' : 'bg-bg-secondary text-text-tertiary',
      )}>
        <CommandIcon name={cmd.icon} className="w-4 h-4" />
      </div>

      {/* 文本 */}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-b2 font-medium truncate">{cmd.label}</p>
        {cmd.description && (
          <p className="text-c1 text-text-tertiary truncate">{cmd.description}</p>
        )}
      </div>

      {/* 分类标签 */}
      <span className={cn('text-c2 px-1.5 py-0.5 rounded flex-shrink-0', categoryColors[cmd.category])}>
        {categoryLabels[cmd.category]}
      </span>

      {/* 快捷键提示 */}
      {cmd.shortcut && (
        <kbd className="text-c2 text-text-tertiary bg-bg-secondary px-1.5 py-0.5 rounded border border-border/50 flex-shrink-0">
          {cmd.shortcut}
        </kbd>
      )}

      {/* 执行箭头 */}
      <ArrowRight className={cn(
        'w-4 h-4 flex-shrink-0 transition-opacity',
        isSelected ? 'opacity-100 text-brand-500' : 'opacity-0',
      )} />
    </button>
  );
}

// ─── 底部快捷键提示 ─────────────────────────────────────────────────────────────
function FooterHint({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <kbd className="text-c2 text-text-tertiary bg-bg-secondary px-1 py-0.5 rounded border border-border/50 min-w-[20px] text-center">
        {keys}
      </kbd>
      <span className="text-c2 text-text-tertiary">{label}</span>
    </div>
  );
}
