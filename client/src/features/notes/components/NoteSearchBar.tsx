import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNoteStore } from '../store/useNoteStore';
import { useShallow } from 'zustand/react/shallow';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * 笔记搜索栏组件
 * v0.9.0: 带 300ms 防抖的搜索输入框 + 结果计数 + 关键词高亮辅助
 */
export function NoteSearchBar() {
  const { searchQuery, searchResults, searchNotes, setSearchQuery } = useNoteStore(useShallow(s => s));
  const prefersReduced = useReducedMotion();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [isSearching, setIsSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // 防抖搜索：300ms
  const debouncedSearch = useCallback(
    (query: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!query.trim()) {
        setSearchQuery('');
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      timerRef.current = setTimeout(async () => {
        await searchNotes(query, { limit: 50, fuzzy: true });
        setIsSearching(false);
      }, 300);
    },
    [searchNotes, setSearchQuery],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalQuery(val);
    debouncedSearch(val);
  };

  const handleClear = () => {
    setLocalQuery('');
    setSearchQuery('');
    setIsSearching(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const resultCount = searchResults.length;
  const showResultBadge = searchQuery.trim().length > 0 && !isSearching;

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <Input
        placeholder="搜索笔记标题和内容..."
        prefix={<Search className="w-4 h-4" strokeWidth={1.5} />}
        suffix={
          <AnimatePresence>
            {isSearching ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={prefersReduced ? { duration: 0.01 } : undefined}
              >
                <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" strokeWidth={1.5} />
              </motion.div>
            ) : localQuery ? (
              <motion.button
                key="clear"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={prefersReduced ? { duration: 0.01 } : { type: 'spring', stiffness: 400, damping: 25 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleClear}
                className="p-0.5 rounded-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary/50 transition-all duration-200"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </motion.button>
            ) : null}
          </AnimatePresence>
        }
        size="sm"
        className="flex-1 min-w-0"
        value={localQuery}
        onChange={handleChange}
      />
      <AnimatePresence>
        {showResultBadge && (
          <motion.span
            initial={prefersReduced ? false : { opacity: 0, scale: 0.8, x: -8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -8 }}
            transition={prefersReduced ? { duration: 0.01 } : { type: 'spring', stiffness: 400, damping: 28 }}
            className={cn(
              'flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium',
              resultCount > 0
                ? 'bg-brand-500/10 text-brand-600 border border-brand-300/30'
                : 'bg-bg-tertiary/40 text-text-tertiary border border-border/30',
            )}
          >
            {resultCount > 0 ? `${resultCount} 条结果` : '无结果'}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
