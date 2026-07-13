import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Trash2, ChevronDown, ChevronUp, X, Check, Wand2, Loader2, ArrowRight } from 'lucide-react';
import { EmptyState, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useInspirationStore, type InspirationItem, type InspirationTags } from '../store/inspirationStore';
import { useShallow } from 'zustand/react/shallow';
import { useAITagContent, useAISortInspiration } from '@/lib/ai/useAI';
import type { SortSuggestion } from '@/lib/ai/types';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const CONTENT_NATURE_OPTIONS: { value: InspirationTags['content_nature']; label: string; color: string; bg: string }[] = [
  { value: 'concept',     label: '概念', color: 'text-accent-600',   bg: 'bg-accent-50 border-accent-200 dark:bg-accent-900/20 dark:border-accent-700' },
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
// Animation variants
// ─────────────────────────────────────────────────────────────

const pageVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
};
const headerVariants = {
  hidden: { opacity: 0, y: -16, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const } },
};
const inputVariants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(3px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const, delay: 0.1 } },
};
const filterVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, delay: 0.15 } },
};
const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.96, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.35, ease: [0.22, 0.61, 0.36, 1] as const } },
  exit: { opacity: 0, x: -20, scale: 0.95, filter: 'blur(3px)', transition: { duration: 0.2 } },
};

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

interface TagChipProps { label: string; color: string; bg: string; onClick?: () => void; }

function TagChip({ label, color, bg, onClick }: TagChipProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn('px-2 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer select-none', color, bg)}
    >
      {label}
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────
// Tag edit popover
// ─────────────────────────────────────────────────────────────

interface TagEditPopoverProps { item: InspirationItem; onClose: () => void; }

function TagEditPopover({ item, onClose }: TagEditPopoverProps) {
  const { updateTags } = useInspirationStore(useShallow(s => s));
  const [nature, setNature] = useState(item.tags.content_nature);
  const [depth, setDepth] = useState(item.tags.cognitive_depth);
  const [subject, setSubject] = useState(item.tags.subject);
  const panelRef = useRef<HTMLDivElement>(null);

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
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const }}
      className={cn(
        'absolute left-0 top-full mt-1 z-30',
        'bg-bg-elevated/90 backdrop-blur-xl border border-border/60 rounded-kb-lg shadow-xl',
        'p-3 w-64 space-y-3',
      )}
    >
      <div>
        <div className="text-c1 text-text-tertiary mb-1">内容性质</div>
        <div className="flex flex-wrap gap-1">
          {CONTENT_NATURE_OPTIONS.map(opt => (
            <motion.button key={opt.value} whileTap={{ scale: 0.9 }}
              onClick={() => setNature(opt.value)}
              className={cn('px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                nature === opt.value ? cn(opt.color, opt.bg, 'ring-1 ring-brand-300') : 'text-text-tertiary bg-bg-secondary border-border/40 hover:text-text-secondary')}>
              {opt.label}
            </motion.button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-c1 text-text-tertiary mb-1">认知深度</div>
        <div className="flex flex-wrap gap-1">
          {COGNITIVE_DEPTH_OPTIONS.map(opt => (
            <motion.button key={opt.value} whileTap={{ scale: 0.9 }}
              onClick={() => setDepth(opt.value)}
              className={cn('px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                depth === opt.value ? cn(opt.color, opt.bg, 'ring-1 ring-brand-300') : 'text-text-tertiary bg-bg-secondary border-border/40 hover:text-text-secondary')}>
              {opt.label}
            </motion.button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-c1 text-text-tertiary mb-1">学科领域</div>
        <input value={subject} onChange={e => setSubject(e.target.value)}
          className={cn('w-full px-2 py-1 rounded-kb-md text-xs bg-bg-secondary border border-border/40 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-300')}
          placeholder="输入学科..." />
      </div>
      <div className="flex justify-end gap-2">
        <motion.button whileTap={{ scale: 0.95 }} onClick={onClose}
          className="px-2 py-1 rounded-kb-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors">取消</motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleSave}
          className="px-2 py-1 rounded-kb-md text-xs bg-brand-600 text-text-inverse hover:bg-brand-700 transition-colors">保存</motion.button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sort suggestion type labels & colors
// ─────────────────────────────────────────────────────────────

const SORT_TYPE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  feynman:  { label: '费曼讲解', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700' },
  flashcard: { label: '闪卡',    color: 'text-cyan-700',    bg: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-900/20 dark:border-cyan-700' },
  note:     { label: '笔记',     color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-700' },
  todo:     { label: '待办',     color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700' },
};

// ─────────────────────────────────────────────────────────────
// AI Sort Panel
// ─────────────────────────────────────────────────────────────

interface AISortPanelProps { suggestions: SortSuggestion[]; item: InspirationItem; onClose: () => void; }

function AISortPanel({ suggestions, item, onClose }: AISortPanelProps) {
  const { toast } = useToast();
  const handleConvert = useCallback((type: string) => {
    const label = SORT_TYPE_MAP[type]?.label ?? type;
    const text = `[${label}] ${item.content}`;
    navigator.clipboard.writeText(text).then(() => {
      toast({ type: 'success', message: `已复制为「${label}」格式到剪贴板` });
    }).catch(() => { toast({ type: 'error', message: '复制失败' }); });
  }, [item.content, toast]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const }}
      className="overflow-hidden"
    >
      <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-c1 font-medium text-text-secondary">AI 归类建议</span>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="text-text-tertiary hover:text-text-secondary transition-colors">
            <X className="w-3.5 h-3.5" />
          </motion.button>
        </div>
        <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}>
          {suggestions.map((s, idx) => {
            const typeInfo = SORT_TYPE_MAP[s.type] ?? { label: s.type, color: 'text-text-secondary', bg: 'bg-bg-secondary border-border' };
            return (
              <motion.div key={idx}
                variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0, transition: { duration: 0.25 } } }}
                className={cn('flex items-center gap-2 p-kb-sm rounded-kb-lg border bg-bg-secondary/50', typeInfo.bg)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-xs font-semibold', typeInfo.color)}>{typeInfo.label}</span>
                    <span className="text-c1 text-text-tertiary">{Math.round(s.confidence * 100)}%</span>
                    {s.confidence < 0.5 && <span className="text-c1 text-orange-500 font-medium">仅供参考</span>}
                  </div>
                  <p className="text-c1 text-text-secondary mt-0.5 truncate">{s.reason}</p>
                </div>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => handleConvert(s.type)}
                  className={cn('flex items-center gap-1 px-2 py-1 rounded-kb-md text-xs font-medium bg-bg-elevated border border-border/50 text-text-secondary hover:text-brand-600 hover:border-brand-300 transition-colors whitespace-nowrap')}>
                  转化 <ArrowRight className="w-3 h-3" />
                </motion.button>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Inspiration Card
// ─────────────────────────────────────────────────────────────

interface InspirationCardProps { item: InspirationItem; }

function InspirationCard({ item }: InspirationCardProps) {
  const { deleteItem } = useInspirationStore(useShallow(s => s));
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortSuggestions, setSortSuggestions] = useState<SortSuggestion[]>([]);
  const { sortInspiration, loading: sortLoading } = useAISortInspiration();
  const { toast } = useToast();

  const natureOpt = NATURE_MAP[item.tags.content_nature];
  const depthOpt  = DEPTH_MAP[item.tags.cognitive_depth];

  const handleDelete = () => { deleteItem(item.id); toast({ type: 'success', message: '已删除' }); };

  const handleSort = async () => {
    if (sortOpen && sortSuggestions.length > 0) { setSortOpen(false); return; }
    setSortOpen(true);
    const existingTags: Record<string, string> = {
      content_nature: item.tags.content_nature, cognitive_depth: item.tags.cognitive_depth, subject: item.tags.subject,
    };
    const result = await sortInspiration(item.content, existingTags);
    if (result) setSortSuggestions(result.suggestions);
    else setSortOpen(false);
  };

  return (
    <motion.div
      layout
      variants={cardVariants}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      exit={cardVariants.exit}
      className="group relative"
    >
      <div className={cn(
        'relative bg-bg-secondary/60 backdrop-blur-xl border border-border/30 rounded-[var(--kb-radius-xl)] p-kb-md',
        'hover:border-purple-400/25 transition-colors duration-300 overflow-hidden',
      )}>
        {/* ── hover 光泽 ── */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(147,51,234,0.04) 0%, transparent 50%, rgba(147,51,234,0.02) 100%)' }} />

        {/* ── Content ── */}
        <div className="relative z-10">
          <p onClick={() => setExpanded(v => !v)}
            className={cn('text-b2 text-text-primary leading-relaxed cursor-pointer', !expanded && 'line-clamp-3')}>
            {item.content}
          </p>
          {item.content.length > 150 && (
            <motion.button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-0.5 mt-1 text-c1 text-text-tertiary hover:text-text-secondary transition-colors"
              whileHover={{ x: 2 }}
            >
              {expanded ? <>收起 <ChevronUp className="w-3 h-3" /></> : <>展开 <ChevronDown className="w-3 h-3" /></>}
            </motion.button>
          )}
        </div>

        {/* ── Tags row ── */}
        <div className="flex items-center gap-2 mt-3 flex-wrap relative z-10">
          <TagChip label={natureOpt?.label ?? item.tags.content_nature} color={natureOpt?.color ?? 'text-text-secondary'}
            bg={natureOpt?.bg ?? 'bg-bg-secondary border-border'} onClick={() => setEditOpen(v => !v)} />
          <TagChip label={depthOpt?.label ?? item.tags.cognitive_depth} color={depthOpt?.color ?? 'text-text-secondary'}
            bg={depthOpt?.bg ?? 'bg-bg-secondary border-border'} onClick={() => setEditOpen(v => !v)} />
          <TagChip label={item.tags.subject} color="text-slate-500"
            bg="bg-slate-50 border-slate-200 dark:bg-slate-800/30 dark:border-slate-600" onClick={() => setEditOpen(v => !v)} />
          {item.tagsManuallyEdited && (
            <span className="text-c1 text-text-tertiary" title="已手动修正标签"><Check className="w-3 h-3 inline mr-0.5" />已修正</span>
          )}
          <AnimatePresence>{editOpen && <TagEditPopover item={item} onClose={() => setEditOpen(false)} />}</AnimatePresence>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/20 relative z-10">
          <span className="text-c1 text-text-tertiary">{formatTime(item.createdAt)}</span>
          <div className="flex items-center gap-1.5">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleSort}
              disabled={sortLoading}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-kb-md text-xs font-medium',
                'bg-gradient-to-r from-purple-500 to-cyan-500 text-text-inverse',
                'hover:from-purple-600 hover:to-cyan-600 shadow-sm shadow-purple-500/20',
                'disabled:opacity-60 disabled:cursor-not-allowed',
              )}
            >
              {sortLoading ? (<><Loader2 className="w-3 h-3 animate-spin" />分析中...</>) : (<><Wand2 className="w-3 h-3" />AI 整理</>)}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleDelete}
              className="flex items-center gap-1 px-2 py-0.5 rounded-kb-md text-xs text-text-tertiary hover:text-semantic-error hover:bg-semantic-error/10 dark:hover:bg-red-900/10 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> 删除
            </motion.button>
          </div>
        </div>

        {/* ── AI Sort panel ── */}
        <AnimatePresence>
          {sortOpen && sortSuggestions.length > 0 && (
            <AISortPanel suggestions={sortSuggestions} item={item} onClose={() => setSortOpen(false)} />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
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
    <motion.div variants={filterVariants} className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-c1 text-text-tertiary min-w-[4em]">性质:</span>
        {CONTENT_NATURE_OPTIONS.map(opt => (
          <motion.button key={opt.value} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => onChange({ ...filters, content_nature: filters.content_nature === opt.value ? null : opt.value })}
            className={cn('px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
              filters.content_nature === opt.value ? cn(opt.color, opt.bg) : 'text-text-tertiary bg-bg-secondary border-border/40 hover:text-text-secondary')}>
            {opt.label}
          </motion.button>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-c1 text-text-tertiary min-w-[4em]">深度:</span>
        {COGNITIVE_DEPTH_OPTIONS.map(opt => (
          <motion.button key={opt.value} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => onChange({ ...filters, cognitive_depth: filters.cognitive_depth === opt.value ? null : opt.value })}
            className={cn('px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
              filters.cognitive_depth === opt.value ? cn(opt.color, opt.bg) : 'text-text-tertiary bg-bg-secondary border-border/40 hover:text-text-secondary')}>
            {opt.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function InspirationPage() {
  const { items, loadAll, addItem } = useInspirationStore(useShallow(s => s));
  const { tagContent, loading: aiLoading } = useAITagContent();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ content_nature: null, cognitive_depth: null, subject: null });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async () => {
    const content = input.trim();
    if (!content) return;
    setSubmitting(true);
    setInput('');
    const defaultTags: InspirationTags = { content_nature: 'inspiration', cognitive_depth: 'shallow', subject: '未分类' };
    addItem(content, defaultTags);
    const addedId = useInspirationStore.getState().items[0]?.id;
    try {
      const result = await tagContent(content);
      if (result && addedId) {
        const currentItems = useInspirationStore.getState().items;
        const target = currentItems.find(i => i.id === addedId);
        if (target && !target.tagsManuallyEdited) {
          useInspirationStore.getState().updateTags(addedId, {
            content_nature: (result.contentNature as InspirationTags['content_nature']) ?? 'inspiration',
            cognitive_depth: (result.cognitiveDepth as InspirationTags['cognitive_depth']) ?? 'shallow',
            subject: result.subject ?? '通用',
          });
          const finalItems = useInspirationStore.getState().items;
          const finalTarget = finalItems.find(i => i.id === addedId);
          if (finalTarget && finalTarget.tagsManuallyEdited) {
            useInspirationStore.setState((s) => ({
              items: s.items.map(i => i.id === addedId ? { ...i, tagsManuallyEdited: false } : i),
            }));
          }
        }
      }
    } catch { /* silent */ }
    finally { setSubmitting(false); textareaRef.current?.focus(); }
  }, [input, addItem, tagContent]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSubmit(); }
  };

  const filteredItems = items.filter(item => {
    if (filters.content_nature && item.tags.content_nature !== filters.content_nature) return false;
    if (filters.cognitive_depth && item.tags.cognitive_depth !== filters.cognitive_depth) return false;
    if (filters.subject && item.tags.subject !== filters.subject) return false;
    return true;
  });
  const subjects = [...new Set(items.map(i => i.tags.subject))].filter(Boolean);

  return (
    <motion.div
      className="max-w-2xl mx-auto px-kb-lg py-kb-xl space-y-6 relative"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── 背景环境光 ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #9333EA 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.05, 0.08, 0.05] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #06B6D4 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.04, 0.07, 0.04] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />
      </div>

      {/* ── Header ── */}
      <motion.div className="flex items-center gap-3 relative z-10" variants={headerVariants}>
        <motion.div
          className="w-9 h-9 rounded-kb-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20"
          whileHover={{ scale: 1.1, rotate: -5 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        >
          <Sparkles className="w-5 h-5 text-text-inverse" strokeWidth={1.5} />
        </motion.div>
        <div>
          <h1 className="text-h2 font-bold text-text-primary">灵感空间</h1>
          <p className="text-c1 text-text-tertiary">随手捕捉灵感，AI 自动整理分类</p>
        </div>
      </motion.div>

      {/* ── Quick input area ── */}
      <motion.div
        variants={inputVariants}
        className={cn(
          'relative bg-bg-secondary/60 backdrop-blur-xl border border-border/30 rounded-[var(--kb-radius-xl)] p-kb-md',
          'focus-within:border-purple-400/40 focus-within:shadow-lg focus-within:shadow-purple-500/5',
          'transition-all duration-300',
        )}
      >
        {/* top accent line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="随手记录灵感、疑问、想法..."
          rows={3}
          className="w-full resize-none text-b2 text-text-primary placeholder:text-text-tertiary bg-transparent focus:outline-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-c1 text-text-tertiary">Ctrl+Enter 提交</span>
          <motion.button
            whileHover={{ scale: 1.03, boxShadow: '0 0 16px rgba(91,138,114,0.2)' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            disabled={!input.trim() || submitting}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium',
              'bg-brand-600 text-text-inverse shadow-md shadow-brand-500/15',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-200',
            )}
          >
            {submitting || aiLoading ? (
              <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />打标中...</>
            ) : (
              <><Send className="w-3.5 h-3.5" />记录</>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* ── Filter bar ── */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            className="bg-bg-secondary/60 backdrop-blur-xl border border-border/30 rounded-[var(--kb-radius-xl)] p-3 relative z-10"
            variants={filterVariants}
          >
            <FilterBar filters={filters} onChange={setFilters} />
            {subjects.length > 0 && (
              <motion.div
                className="flex items-center gap-2 flex-wrap mt-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <span className="text-c1 text-text-tertiary min-w-[4em]">学科:</span>
                {subjects.map(s => (
                  <motion.button key={s} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => setFilters(f => ({ ...f, subject: f.subject === s ? null : s }))}
                    className={cn('px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                      filters.subject === s
                        ? 'text-slate-700 bg-slate-100 border-slate-300 dark:text-slate-200 dark:bg-slate-700 dark:border-slate-500'
                        : 'text-text-tertiary bg-bg-secondary border-border/40 hover:text-text-secondary')}>
                    {s}
                  </motion.button>
                ))}
                {filters.subject && (
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => setFilters(f => ({ ...f, subject: null }))}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs text-text-tertiary hover:text-semantic-error transition-colors">
                    <X className="w-3 h-3" /> 清除
                  </motion.button>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Inspiration list ── */}
      {filteredItems.length > 0 ? (
        <motion.div className="space-y-3 relative z-10" variants={listVariants}>
          <AnimatePresence mode="popLayout">
            {filteredItems.map(item => <InspirationCard key={item.id} item={item} />)}
          </AnimatePresence>
        </motion.div>
      ) : items.length > 0 ? (
        <motion.div className="text-center py-12 relative z-10"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <p className="text-b2 text-text-tertiary">没有匹配的灵感记录</p>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setFilters({ content_nature: null, cognitive_depth: null, subject: null })}
            className="mt-2 text-sm text-brand-600 hover:underline">
            清除筛选
          </motion.button>
        </motion.div>
      ) : (
        <motion.div className="relative z-10"
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <EmptyState
            icon={<Sparkles className="w-12 h-12 text-purple-300" strokeWidth={1} />}
            title="还没有灵感记录"
            description="开始记录你的第一个想法吧"
          />
        </motion.div>
      )}
    </motion.div>
  );
}
