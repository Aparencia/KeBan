import { useState, useCallback, useEffect } from 'react';
import { X, Bug, Lightbulb, Star, Send, CheckCircle, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────

type FeedbackType = 'bug' | 'suggestion' | 'experience';
type FeedbackStatus = 'pending' | 'sent';

interface FeedbackItem {
  id: string;
  type: FeedbackType;
  description: string;
  rating?: number;
  createdAt: string; // ISO string for JSON serialization
  status: FeedbackStatus;
}

interface FeedbackPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = 'keban_feedback';
const FEEDBACK_EMAIL = 'x3508634878@163.com';
const MAX_LENGTH = 500;
const MAX_HISTORY = 20;

const TYPE_OPTIONS: { value: FeedbackType; label: string; icon: typeof Bug; emoji: string }[] = [
  { value: 'bug', label: 'Bug', icon: Bug, emoji: '🐛' },
  { value: 'suggestion', label: '建议', icon: Lightbulb, emoji: '💡' },
  { value: 'experience', label: '体验', icon: Star, emoji: '⭐' },
];

// ─── Helpers ────────────────────────────────────────────────────

function loadFeedback(): FeedbackItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FeedbackItem[];
  } catch {
    return [];
  }
}

function saveFeedback(items: FeedbackItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function feedbackTypeLabel(type: FeedbackType): string {
  return TYPE_LABEL_MAP[type] ?? type;
}

function sendFeedbackByEmail(feedback: FeedbackItem): void {
  const subject = encodeURIComponent(
    `[课伴反馈] ${feedbackTypeLabel(feedback.type)} - ${new Date().toLocaleDateString('zh-CN')}`,
  );
  const body = encodeURIComponent(
    `反馈类型: ${feedbackTypeLabel(feedback.type)}\n` +
    `描述: ${feedback.description}\n` +
    (feedback.rating ? `评分: ${feedback.rating}/5\n` : '') +
    `提交时间: ${new Date().toISOString()}\n`,
  );
  window.open(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`, '_blank');
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// ─── Star Rating ────────────────────────────────────────────────

interface StarRatingProps {
  value: number;
  onChange: (v: number) => void;
}

function StarRating({ value, onChange }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 transition-colors duration-kb-fast"
          aria-label={`${n}星`}
        >
          <Star
            className={cn(
              'w-5 h-5 transition-colors duration-kb-fast',
              n <= (hover || value)
                ? 'fill-brand-500 text-brand-500'
                : 'text-text-tertiary',
            )}
            strokeWidth={1.5}
          />
        </button>
      ))}
      <span className="ml-1 text-c1 text-text-tertiary">
        {value > 0 ? `${value}/5` : ''}
      </span>
    </div>
  );
}

// ─── Feedback Form ──────────────────────────────────────────────

interface FeedbackFormProps {
  onSubmit: (item: FeedbackItem) => void;
  onSendEmail: (item: FeedbackItem) => void;
}

function FeedbackForm({ onSubmit, onSendEmail }: FeedbackFormProps) {
  const [type, setType] = useState<FeedbackType>('bug');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const charCount = description.length;
  const isValid = description.trim().length > 0 && (type !== 'experience' || rating > 0);

  const handleSubmit = useCallback(() => {
    if (!isValid) return;
    const item: FeedbackItem = {
      id: crypto.randomUUID(),
      type,
      description: description.trim(),
      rating: type === 'experience' ? rating : undefined,
      createdAt: new Date().toISOString(),
      status: 'sent',
    };
    onSubmit(item);
    setDescription('');
    setRating(0);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  }, [type, description, rating, isValid, onSubmit]);

  const handleSendEmail = useCallback(() => {
    if (!isValid) return;
    const item: FeedbackItem = {
      id: crypto.randomUUID(),
      type,
      description: description.trim(),
      rating: type === 'experience' ? rating : undefined,
      createdAt: new Date().toISOString(),
      status: 'sent',
    };
    onSubmit(item);
    onSendEmail(item);
    setDescription('');
    setRating(0);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 2000);
  }, [type, description, rating, isValid, onSubmit, onSendEmail]);

  return (
    <div className="space-y-kb-md">
      {/* Type selector */}
      <div className="flex gap-kb-xs">
        {TYPE_OPTIONS.map(({ value, label, icon: Icon, emoji }) => (
          <button
            key={value}
            type="button"
            onClick={() => setType(value)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-kb-sm rounded-kb-md',
              'text-b2 font-medium transition-all duration-kb-fast',
              type === value
                ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 shadow-kb-sm'
                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
            )}
          >
            <span className="text-b1">{emoji}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Description */}
      <div className="relative">
        <textarea
          value={description}
          onChange={(e) => {
            if (e.target.value.length <= MAX_LENGTH) {
              setDescription(e.target.value);
            }
          }}
          placeholder={
            type === 'bug'
              ? '描述你遇到的问题…'
              : type === 'suggestion'
                ? '分享你的改进建议…'
                : '评价你的使用体验…'
          }
          rows={4}
          className={cn(
            'w-full resize-none rounded-kb-md border border-border/50',
            'bg-bg-primary px-kb-md py-kb-sm text-b2 text-text-primary',
            'placeholder:text-text-tertiary',
            'focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50',
            'transition-all duration-kb-fast',
          )}
        />
        <span
          className={cn(
            'absolute bottom-kb-xs right-kb-sm text-c2',
            charCount >= MAX_LENGTH * 0.9 ? 'text-semantic-error' : 'text-text-tertiary',
          )}
        >
          {charCount}/{MAX_LENGTH}
        </span>
      </div>

      {/* Star rating (experience only) */}
      {type === 'experience' && (
        <div className="flex items-center gap-kb-sm">
          <span className="text-b2 text-text-secondary">评分</span>
          <StarRating value={rating} onChange={setRating} />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-kb-xs">
        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || submitted}
          className={cn(
            'flex-1 flex items-center justify-center gap-kb-xs py-kb-sm rounded-kb-md',
            'text-b2 font-medium transition-all duration-kb-fast',
            submitted
              ? 'bg-semantic-success text-white'
              : isValid
                ? 'bg-brand-600 text-white hover:bg-brand-700 active:scale-[0.98]'
                : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed',
          )}
        >
          {submitted ? (
            <>
              <CheckCircle className="w-icon-sm h-icon-sm" />
              <span>已提交</span>
            </>
          ) : (
            <>
              <Send className="w-icon-sm h-icon-sm" />
              <span>提交反馈</span>
            </>
          )}
        </button>

        {/* Send email button */}
        <button
          type="button"
          onClick={handleSendEmail}
          disabled={!isValid || emailSent}
          className={cn(
            'flex items-center justify-center gap-kb-xs py-kb-sm px-kb-md rounded-kb-md',
            'text-b2 font-medium transition-all duration-kb-fast',
            emailSent
              ? 'bg-semantic-success text-white'
              : isValid
                ? 'bg-brand-100 text-brand-700 hover:bg-brand-200 active:scale-[0.98] dark:bg-brand-900/30 dark:text-brand-400 dark:hover:bg-brand-900/50'
                : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed',
          )}
          title="通过邮件发送反馈"
        >
          {emailSent ? (
            <CheckCircle className="w-icon-sm h-icon-sm" />
          ) : (
            <Mail className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── History List ───────────────────────────────────────────────

interface FeedbackHistoryProps {
  items: FeedbackItem[];
}

const TYPE_ICON_MAP: Record<FeedbackType, string> = {
  bug: '🐛',
  suggestion: '💡',
  experience: '⭐',
};

const TYPE_LABEL_MAP: Record<FeedbackType, string> = {
  bug: 'Bug',
  suggestion: '建议',
  experience: '体验',
};

function FeedbackHistory({ items }: FeedbackHistoryProps) {
  if (items.length === 0) {
    return (
      <p className="text-center text-b3 text-text-tertiary py-kb-lg">
        暂无反馈记录
      </p>
    );
  }

  return (
    <ul className="space-y-kb-xs">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            'flex items-start gap-kb-sm p-kb-sm rounded-kb-md',
            'bg-bg-secondary/50 hover:bg-bg-secondary transition-colors duration-kb-fast',
          )}
        >
          <span className="text-b1 flex-shrink-0 mt-0.5">
            {TYPE_ICON_MAP[item.type]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-kb-xs mb-0.5">
              <span className="text-c1 font-medium text-text-secondary">
                {TYPE_LABEL_MAP[item.type]}
              </span>
              {item.rating && (
                <span className="text-c2 text-brand-500">
                  {'★'.repeat(item.rating)}
                </span>
              )}
              <span className="ml-auto text-c2 text-text-tertiary flex-shrink-0">
                {formatTime(item.createdAt)}
              </span>
            </div>
            <p className="text-b3 text-text-primary truncate">
              {item.description}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────

export default function FeedbackPanel({ isOpen, onClose }: FeedbackPanelProps) {
  const [items, setItems] = useState<FeedbackItem[]>(() => loadFeedback());

  // Sync to localStorage whenever items change
  useEffect(() => {
    saveFeedback(items);
  }, [items]);

  const handleSubmit = useCallback((item: FeedbackItem) => {
    setItems((prev) => [item, ...prev].slice(0, MAX_HISTORY));
  }, []);

  const handleSendEmail = useCallback((item: FeedbackItem) => {
    sendFeedbackByEmail(item);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/30 backdrop-blur-sm',
          'transition-opacity duration-kb-normal',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      {/* Drawer */}
      <aside
        className={cn(
          'fixed top-0 right-0 z-50 h-screen w-[360px] max-w-[90vw]',
          'bg-bg-elevated border-l border-border/50 shadow-kb-lg',
          'flex flex-col',
          'transition-transform duration-kb-normal ease-kb-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-label="反馈面板"
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-kb-lg py-kb-md border-b border-border/30 flex-shrink-0">
          <h2 className="text-h3 font-semibold text-text-primary">
            反馈
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'p-1 rounded-kb-md',
              'text-text-tertiary hover:text-text-primary hover:bg-bg-secondary',
              'transition-colors duration-kb-fast',
            )}
            aria-label="关闭反馈面板"
          >
            <X className="w-icon-md h-icon-md" strokeWidth={1.5} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-kb-lg py-kb-md space-y-kb-lg">
          {/* Form section */}
          <section>
            <h3 className="text-b2 font-medium text-text-secondary mb-kb-sm">
              提交反馈
            </h3>
            <FeedbackForm onSubmit={handleSubmit} onSendEmail={handleSendEmail} />
          </section>

          {/* Divider */}
          <div className="border-t border-border/30" />

          {/* History section */}
          <section>
            <h3 className="text-b2 font-medium text-text-secondary mb-kb-sm">
              历史记录
            </h3>
            <FeedbackHistory items={items} />
          </section>
        </div>

        {/* Footer contact info */}
        <div className="px-kb-lg py-kb-md border-t border-border-light flex-shrink-0">
          <p className="text-c2 text-text-tertiary">
            反馈邮箱：{FEEDBACK_EMAIL}
          </p>
          <p className="text-c2 text-text-tertiary mt-0.5">
            您的反馈将帮助我们改进课伴
          </p>
        </div>
      </aside>
    </>
  );
}
