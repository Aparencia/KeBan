import { useEffect, useState, useCallback, useRef } from 'react';
import { Sparkles, Send, Trash2, ChevronDown, ChevronUp, X, Check } from 'lucide-react';
import { EmptyState, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useInspirationStore, type InspirationItem, type InspirationTags } from '../store/inspirationStore';
import { useAITagContent } from '@/lib/ai/useAI';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const CONTENT_NATURE_OPTIONS: { value: InspirationTags['content_nature']; label: string; color: string; bg: string }[] = [
  { value: 'concept',     label: '概念', color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700' },
  { value: 'question',    label: '疑问', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700' },
  { value: 'inspiration', label: '灵感', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-700' },
  { value: 'todo',        label: '待办', color: 'text-green-600',  bg: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700' },
];

const COGNITIVE_DEPTH_OPTIONS: { value: InspirationTags['cognitive_depth']; label: string; color: string; bg: string }[] = [
  { value: 'shallow',      label: '浅层',   color: 'text-slate-500',  bg: 'bg-slate-50 border-slate-200 dark:bg-slate-800/30 dark:border-slate-600' },
  { value: 'understanding', label: '理解层', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-700' },
  { value: 'application',   label: '应用层', color: 'text-rose-600',   bg: 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-700' },
];

const NATURE_MAP = Object.fromEntries(CONTENT_NATURE_OPTIONS.map(o => [o.value, o])) as Record<string, typeof CONTENT_NATURE_OPTIONS[0]>;
const DEPTH_MAP  = Object.fromEntries(COGNITIVE_DEPTH_OPTIONS.map(o => [o.value, o])) as Record<string, typeof COGNITIVE_DEPTH_OPTIONS[0]>;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────
// Tag chip component
// ─────────────────────────────────────────────────────────────

interface TagChipProps {
  label: string;
  color: string;
  bg: string;
  onClick?: () => void;
}

function TagChip({ label, color, bg, onClick }: TagChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
        'hover:opacity-80 cursor-pointer select-none',
        color, bg,
      )}
    >
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Tag edit popover
// ─────────────────────────────────────────────────────────────

interface TagEditPopoverProps {
  item: InspirationItem;
  onClose: () => void;
}

function TagEditPopover({ item, onClose }: TagEditPopoverProps) {
  const { updateTags } = useInspirationStore();
  const [nature, setNature] = useState(item.tags.content_nature);
  const [depth, setDepth] = useState(item.tags.cognitive_depth);
  const [subject, setSubject] = useState(item.tags.subject);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSave = () => {
    updateTags(item.id, { content_nature: nature, cognitive_depth: depth, subject });
    onClose();
  };

  return (
    <div
      ref={panelRef}
      className={cn(
        'absolute left-0 top-full mt-1 z-30',
        'bg-bg-elevated border border-border/60 rounded-kb-lg shadow-lg',
        'p-3 w-64 space-y-3',
      )}
    >
      {/* Content nature */}
      <div>
        <div className="text-c1 text-text-tertiary mb-1">内容性质</div>
        <div className="flex flex-wrap gap-1">
          {CONTENT_NATURE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setNature(opt.value)}
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                nature === opt.value
                  ? cn(opt.color, opt.bg, 'ring-1 ring-brand-300')
                  : 'text-text-tertiary bg-bg-secondary border-border/40 hover:text-text-secondary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {/* Cognitive depth */}
      <div>
        <div className="text-c1 text-text-tertiary mb-1">认知深度</div>
        <div className="flex flex-wrap gap-1">
          {COGNITIVE_DEPTH_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDepth(opt.value)}
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                depth === opt.value
                  ? cn(opt.color, opt.bg, 'ring-1 ring-brand-300')
                  : 'text-text-tertiary bg-bg-secondary border-border/40 hover:text-text-secondary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {/* Subject */}
      <div>
        <div className="text-c1 text-text-tertiary mb-1">学科领域</div>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className={cn(
            'w-full px-2 py-1 rounded-kb-md text-xs',
            'bg-bg-secondary border border-border/40',
            'text-text-primary placeholder:text-text-tertiary',
            'focus:outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-300',
          )}
          placeholder="输入学科..."
        />
      </div>
      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-2 py-1 rounded-kb-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="px-2 py-1 rounded-kb-md text-xs bg-brand-600 text-white hover:bg-brand-700 transition-colors"
        >
          保存
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Inspiration Card
// ─────────────────────────────────────────────────────────────

interface InspirationCardProps {
  item: InspirationItem;
}

function InspirationCard({ item }: InspirationCardProps) {
  const { deleteItem } = useInspirationStore();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { toast } = useToast();

  const natureOpt = NATURE_MAP[item.tags.content_nature];
  const depthOpt  = DEPTH_MAP[item.tags.cognitive_depth];

  const handleDelete = () => {
    deleteItem(item.id);
    toast({ type: 'success', message: '已删除' });
  };

  return (
    <div className={cn(
      'bg-bg-elevated border border-border/50 rounded-kb-xl p-4',
      'transition-all duration-kb-fast',
      'hover:border-border/80 hover:shadow-sm',
    )}>
      {/* Content */}
      <div className="relative">
        <p
          onClick={() => setExpanded(v => !v)}
          className={cn(
            'text-b2 text-text-primary leading-relaxed cursor-pointer',
            !expanded && 'line-clamp-3',
          )}
        >
          {item.content}
        </p>
        {item.content.length > 150 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-0.5 mt-1 text-c1 text-text-tertiary hover:text-text-secondary transition-colors"
          >
            {expanded ? <>收起 <ChevronUp className="w-3 h-3" /></> : <>展开 <ChevronDown className="w-3 h-3" /></>}
          </button>
        )}
      </div>

      {/* Tags row */}
      <div className="flex items-center gap-2 mt-3 flex-wrap relative">
        <TagChip
          label={natureOpt?.label ?? item.tags.content_nature}
          color={natureOpt?.color ?? 'text-gray-600'}
          bg={natureOpt?.bg ?? 'bg-gray-50 border-gray-200'}
          onClick={() => setEditOpen(v => !v)}
        />
        <TagChip
          label={depthOpt?.label ?? item.tags.cognitive_depth}
          color={depthOpt?.color ?? 'text-gray-600'}
          bg={depthOpt?.bg ?? 'bg-gray-50 border-gray-200'}
          onClick={() => setEditOpen(v => !v)}
        />
        <TagChip
          label={item.tags.subject}
          color="text-slate-500"
          bg="bg-slate-50 border-slate-200 dark:bg-slate-800/30 dark:border-slate-600"
          onClick={() => setEditOpen(v => !v)}
        />
        {item.tagsManuallyEdited && (
          <span className="text-c1 text-text-tertiary" title="已手动修正标签">
            <Check className="w-3 h-3 inline mr-0.5" />已修正
          </span>
        )}
        {editOpen && <TagEditPopover item={item} onClose={() => setEditOpen(false)} />}
      </div>

      {/* Footer: time + delete */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/20">
        <span className="text-c1 text-text-tertiary">{formatTime(item.createdAt)}</span>
        <button
          onClick={handleDelete}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-kb-md text-xs',
            'text-text-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10',
            'transition-colors',
          )}
        >
          <Trash2 className="w-3 h-3" /> 删除
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Filter Bar
// ─────────────────────────────────────────────────────────────

interface FilterState {
  content_nature: InspirationTags['content_nature'] | null;
  cognitive_depth: InspirationTags['cognitive_depth'] | null;
  subject: string | null;
}

function FilterBar({ filters, onChange }: { filters: FilterState; onChange: (f: FilterState) => void }) {
  return (
    <div className="space-y-2">
      {/* Content nature filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-c1 text-text-tertiary min-w-[4em]">性质:</span>
        {CONTENT_NATURE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange({ ...filters, content_nature: filters.content_nature === opt.value ? null : opt.value })}
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
              filters.content_nature === opt.value
                ? cn(opt.color, opt.bg)
                : 'text-text-tertiary bg-bg-secondary border-border/40 hover:text-text-secondary',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {/* Cognitive depth filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-c1 text-text-tertiary min-w-[4em]">深度:</span>
        {COGNITIVE_DEPTH_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange({ ...filters, cognitive_depth: filters.cognitive_depth === opt.value ? null : opt.value })}
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
              filters.cognitive_depth === opt.value
                ? cn(opt.color, opt.bg)
                : 'text-text-tertiary bg-bg-secondary border-border/40 hover:text-text-secondary',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function InspirationPage() {
  const { items, loadAll, addItem } = useInspirationStore();
  const { tagContent, loading: aiLoading } = useAITagContent();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ content_nature: null, cognitive_depth: null, subject: null });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSubmit = useCallback(async () => {
    const content = input.trim();
    if (!content) return;

    setSubmitting(true);
    setInput('');

    // Default tags (will be replaced by AI)
    const defaultTags: InspirationTags = {
      content_nature: 'inspiration',
      cognitive_depth: 'shallow',
      subject: '未分类',
    };

    addItem(content, defaultTags);
    const addedId = useInspirationStore.getState().items[0]?.id;

    // Async AI tagging
    try {
      const result = await tagContent(content);
      if (result && addedId) {
        const currentItems = useInspirationStore.getState().items;
        const target = currentItems.find(i => i.id === addedId);
        // Only update if user hasn't manually edited tags
        if (target && !target.tagsManuallyEdited) {
          useInspirationStore.getState().updateTags(addedId, {
            content_nature: (result.contentNature as InspirationTags['content_nature']) ?? 'inspiration',
            cognitive_depth: (result.cognitiveDepth as InspirationTags['cognitive_depth']) ?? 'shallow',
            subject: result.subject ?? '通用',
          });
          // Undo manuallyEdited flag since this was auto-tagging
          const finalItems = useInspirationStore.getState().items;
          const finalTarget = finalItems.find(i => i.id === addedId);
          if (finalTarget && finalTarget.tagsManuallyEdited) {
            // Use internal set to clear the flag for auto-tagged items
            useInspirationStore.setState((s) => ({
              items: s.items.map(i => i.id === addedId ? { ...i, tagsManuallyEdited: false } : i),
            }));
            // Also update localStorage
            const raw = localStorage.getItem('keban-inspirations');
            if (raw) {
              const parsed = JSON.parse(raw);
              const updated = parsed.map((i: InspirationItem) =>
                i.id === addedId ? { ...i, tagsManuallyEdited: false } : i
              );
              localStorage.setItem('keban-inspirations', JSON.stringify(updated));
            }
          }
        }
      }
    } catch {
      // AI tagging failed silently, default tags remain
    } finally {
      setSubmitting(false);
      textareaRef.current?.focus();
    }
  }, [input, addItem, tagContent]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Filtered items
  const filteredItems = items.filter(item => {
    if (filters.content_nature && item.tags.content_nature !== filters.content_nature) return false;
    if (filters.cognitive_depth && item.tags.cognitive_depth !== filters.cognitive_depth) return false;
    if (filters.subject && item.tags.subject !== filters.subject) return false;
    return true;
  });

  // Unique subjects for filter
  const subjects = [...new Set(items.map(i => i.tags.subject))].filter(Boolean);

  return (
    <div className="max-w-2xl mx-auto px-kb-lg py-kb-xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-kb-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-h2 font-bold text-text-primary">灵感空间</h1>
          <p className="text-c1 text-text-tertiary">随手捕捉灵感，AI 自动整理分类</p>
        </div>
      </div>

      {/* Quick input area */}
      <div className={cn(
        'bg-bg-elevated border border-border/60 rounded-kb-xl p-4',
        'focus-within:border-brand-300 focus-within:ring-1 focus-within:ring-brand-200',
        'transition-all duration-kb-fast',
      )}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="随手记录灵感、疑问、想法..."
          rows={3}
          className={cn(
            'w-full resize-none',
            'text-b2 text-text-primary placeholder:text-text-tertiary',
            'bg-transparent',
            'focus:outline-none',
          )}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-c1 text-text-tertiary">Ctrl+Enter 提交</span>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || submitting}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-kb-lg text-sm font-medium',
              'bg-brand-600 text-white',
              'hover:bg-brand-700 active:scale-95',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
              'transition-all duration-kb-fast',
            )}
          >
            {submitting || aiLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                打标中...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                记录
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {items.length > 0 && (
        <div className={cn(
          'bg-bg-elevated border border-border/50 rounded-kb-xl p-3',
        )}>
          <FilterBar filters={filters} onChange={setFilters} />
          {/* Subject filter (only if subjects exist) */}
          {subjects.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <span className="text-c1 text-text-tertiary min-w-[4em]">学科:</span>
              {subjects.map(s => (
                <button
                  key={s}
                  onClick={() => setFilters(f => ({ ...f, subject: f.subject === s ? null : s }))}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                    filters.subject === s
                      ? 'text-slate-700 bg-slate-100 border-slate-300 dark:text-slate-200 dark:bg-slate-700 dark:border-slate-500'
                      : 'text-text-tertiary bg-bg-secondary border-border/40 hover:text-text-secondary',
                  )}
                >
                  {s}
                </button>
              ))}
              {filters.subject && (
                <button
                  onClick={() => setFilters(f => ({ ...f, subject: null }))}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs text-text-tertiary hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" /> 清除
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inspiration list */}
      {filteredItems.length > 0 ? (
        <div className="space-y-3">
          {filteredItems.map(item => (
            <InspirationCard key={item.id} item={item} />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="text-center py-12">
          <p className="text-b2 text-text-tertiary">没有匹配的灵感记录</p>
          <button
            onClick={() => setFilters({ content_nature: null, cognitive_depth: null, subject: null })}
            className="mt-2 text-sm text-brand-600 hover:underline"
          >
            清除筛选
          </button>
        </div>
      ) : (
        <EmptyState
          icon={<Sparkles className="w-12 h-12 text-purple-300" strokeWidth={1} />}
          title="还没有灵感记录"
          description="开始记录你的第一个想法吧"
        />
      )}
    </div>
  );
}
