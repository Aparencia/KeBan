import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import {
  Timer, FileText, Layers, Lightbulb, CheckCircle2,
  Activity, PenLine, Brain, Flame, Sparkles, Shield,
} from 'lucide-react';
import { Card, Skeleton, EmptyState, RichTooltip, KnowledgeGalaxy } from '@/components/ui';
import type { StarPoint } from '@/components/ui/KnowledgeGalaxy';
import { cn } from '@/lib/utils';
import { pomodoroSessionStore, flashcardStore, flashcardReviewStore } from '@/lib/storage';
import { useFlashcardStore } from '@/features/flashcards/store/useFlashcardStore';
import { useNoteStore } from '@/features/notes/store/useNoteStore';
import { useFeynmanStore } from '@/features/feynman/store/useFeynmanStore';
import { useCheckIn } from '@/lib/checkin/useCheckIn';
import AchievementPanel from '../components/AchievementPanel';
import type { PomodoroSession, Flashcard, FlashcardReview, StudyCheckIn } from '@/types/models';

/* ── 工具函数 ── */
const accentText: Record<string, string> = {
  pomodoro: 'text-pomodoro', note: 'text-note',
  flashcard: 'text-flashcard', feynman: 'text-feynman',
};
const accentBg: Record<string, string> = {
  pomodoro: 'bg-pomodoro/10', note: 'bg-note/10',
  flashcard: 'bg-flashcard/10', feynman: 'bg-feynman/10',
};
const accentDot: Record<string, string> = {
  pomodoro: 'bg-brand-500', note: 'bg-note',
  flashcard: 'bg-flashcard', feynman: 'bg-feynman',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function getTodayLabel() {
  const d = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekdays[d.getDay()]}`;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/* ── 3D 倾斜卡片组件 ── */
function TiltCard({ children, className, ...props }: {
  children: React.ReactNode;
  className?: string;
  [key: string]: unknown;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-6, 6]), { stiffness: 300, damping: 30 });
  const glowX = useTransform(mouseX, [-0.5, 0.5], ['0%', '100%']);
  const glowY = useTransform(mouseY, [-0.5, 0.5], ['0%', '100%']);

  function handleMouseMove(e: React.MouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleMouseLeave() {
    mouseX.set(0); mouseY.set(0);
  }

  return (
    <motion.div
      ref={ref}
      className={cn('relative overflow-hidden', className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 800 }}
      whileHover={{ zIndex: 10 }}
      {...props}
    >
      {/* 动态光泽 */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-500"
        style={{
          background: useTransform(
            [glowX, glowY],
            ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(91,138,114,0.08) 0%, transparent 60%)`
          ),
        }}
      />
      {children}
    </motion.div>
  );
}

/* ── 计数器动画 Hook ── */
function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let start = 0;
    const startTime = performance.now();
    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

/* ── 活动条目类型 ── */
interface ActivityItem {
  icon: typeof Timer;
  text: string;
  time: string;
  accent: string;
  timestamp: number;
}

/* ── 快速操作 ── */
const quickActions = [
  { label: '番茄钟', icon: Timer, path: '/pomodoro', accent: 'pomodoro' as const, gradient: 'from-brand-400/20 to-brand-600/10' },
  { label: '智能笔记', icon: FileText, path: '/notes', accent: 'note' as const, gradient: 'from-note/20 to-note/5' },
  { label: '闪卡', icon: Layers, path: '/flashcards', accent: 'flashcard' as const, gradient: 'from-flashcard/20 to-flashcard/5' },
  { label: '费曼学习', icon: Lightbulb, path: '/feynman', accent: 'feynman' as const, gradient: 'from-feynman/20 to-feynman/5' },
];

/* ── 容器动画 ── */
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const } },
};

/* ══════════════════════════════════════════
   Dashboard 页面组件
   ══════════════════════════════════════════ */
export default function DashboardPage() {
  const navigate = useNavigate();

  const { streakDays, todayCheckIn, loading: checkInLoading, loadMonthData } = useCheckIn('dashboard');
  const [monthRecords, setMonthRecords] = useState<StudyCheckIn[]>([]);
  useEffect(() => { loadMonthData().then(setMonthRecords); }, [loadMonthData]);

  const calendarDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const checkedDates = new Set(monthRecords.map((r) => r.date));
    const todayStr = now.toISOString().split('T')[0];
    const cells: { day: number | null; checked: boolean; isToday: boolean }[] = [];
    for (let i = 0; i < startDow; i++) cells.push({ day: null, checked: false, isToday: false });
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, checked: checkedDates.has(dateStr), isToday: dateStr === todayStr });
    }
    return cells;
  }, [monthRecords]);

  const loadDecks = useFlashcardStore((s) => s.loadDecks);
  const notes = useNoteStore((s) => s.notes);
  const loadNotes = useNoteStore((s) => s.loadNotes);
  const feynmanNotes = useFeynmanStore((s) => s.notes);
  const loadFeynmanNotes = useFeynmanStore((s) => s.loadNotes);

  const [isLoading, setIsLoading] = useState(true);
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([]);
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [flashcardReviews, setFlashcardReviews] = useState<FlashcardReview[]>([]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      loadDecks(), loadNotes(), loadFeynmanNotes(),
      pomodoroSessionStore.getAll().then(setPomodoroSessions),
      flashcardStore.getAll().then(setAllCards),
      flashcardReviewStore.getAll().then(setFlashcardReviews),
    ]).finally(() => setIsLoading(false));
  }, []); // eslint-disable-line

  const todayPomodoroCount = useMemo(() => {
    const today = new Date().toDateString();
    return pomodoroSessions.filter((s) => new Date(s.completedAt).toDateString() === today).length;
  }, [pomodoroSessions]);
  const noteTotal = notes.length;
  const dueFlashcardCount = useMemo(() => allCards.filter((c) => new Date(c.dueDate) <= new Date()).length, [allCards]);
  const feynmanInProgressCount = useMemo(() => feynmanNotes.filter((n) => n.status === 'in_progress').length, [feynmanNotes]);

  const overviewCards = [
    { label: '今日番茄', value: todayPomodoroCount, unit: '个', icon: Timer, accent: 'pomodoro' as const },
    { label: '笔记总数', value: noteTotal, unit: '篇', icon: FileText, accent: 'note' as const },
    { label: '待复习闪卡', value: dueFlashcardCount, unit: '张', icon: Layers, accent: 'flashcard' as const },
    { label: '费曼进行中', value: feynmanInProgressCount, unit: '个', icon: Lightbulb, accent: 'feynman' as const },
  ];

  const starPoints = useMemo<StarPoint[]>(() => {
    const noteIds = new Set(notes.map((n) => n.id));
    const feynmanIds = new Set(feynmanNotes.map((n) => n.id));
    return allCards.filter((c) => c.repetitions >= 1).map((c) => {
      let color: StarPoint['color'] = 'brand';
      if (c.sourceNoteId) {
        if (feynmanIds.has(c.sourceNoteId)) color = 'purple';
        else if (noteIds.has(c.sourceNoteId)) color = 'accent';
      }
      const title = c.front.replace(/<[^>]*>/g, '').slice(0, 20) || '未命名卡片';
      return { id: c.id, title, color };
    });
  }, [allCards, notes, feynmanNotes]);

  const recentActivities = useMemo(() => {
    const activities: ActivityItem[] = [];
    pomodoroSessions.forEach((s) => {
      const d = new Date(s.completedAt);
      activities.push({ icon: CheckCircle2, text: `完成了 ${Math.round(s.actualDuration / 60)} 分钟番茄钟`, time: formatRelativeTime(d), accent: 'pomodoro', timestamp: d.getTime() });
    });
    notes.forEach((n) => {
      const d = new Date(n.updatedAt);
      activities.push({ icon: PenLine, text: `笔记「${n.title || '无标题'}」`, time: formatRelativeTime(d), accent: 'note', timestamp: d.getTime() });
    });
    feynmanNotes.forEach((fn) => {
      const d = new Date(fn.updatedAt);
      activities.push({ icon: Brain, text: `费曼学习「${fn.concept}」`, time: formatRelativeTime(d), accent: 'feynman', timestamp: d.getTime() });
    });
    flashcardReviews.slice(0, 20).forEach((review) => {
      const d = new Date(review.reviewedAt);
      const ratingLabel = ['Again', 'Hard', 'Good', 'Easy'][review.rating - 1] ?? '';
      activities.push({ icon: Layers, text: `复习了闪卡（${ratingLabel}）`, time: formatRelativeTime(d), accent: 'flashcard', timestamp: d.getTime() });
    });
    activities.sort((a, b) => b.timestamp - a.timestamp);
    return activities.slice(0, 8);
  }, [pomodoroSessions, notes, feynmanNotes, flashcardReviews]);

  /* ── 计数器 ── */
  const countPomodoro = useCountUp(todayPomodoroCount);
  const countNotes = useCountUp(noteTotal);
  const countFlashcards = useCountUp(dueFlashcardCount);
  const countFeynman = useCountUp(feynmanInProgressCount);
  const countStreak = useCountUp(streakDays);
  const counters = [countPomodoro, countNotes, countFlashcards, countFeynman];

  return (
    <motion.div
      className="px-6 py-8 max-w-[1100px] mx-auto flex flex-col gap-8 relative"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── 背景装饰：微妙的渐变光斑 ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-400/[0.04] blur-3xl kb-ambient-glow" />
        <div className="absolute -bottom-48 -left-48 w-[500px] h-[500px] rounded-full bg-accent-400/[0.03] blur-3xl kb-ambient-glow" style={{ animationDelay: '2.5s' }} />
      </div>

      {/* ── 欢迎区 ── */}
      <motion.header className="flex flex-col gap-1" variants={itemVariants}>
        <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">
          {getGreeting()}，开始今天的学习吧
        </h1>
        <p className="text-[13px] text-text-tertiary">{getTodayLabel()}</p>
      </motion.header>

      {/* ── AI 洞察卡片 ── */}
      <motion.div variants={cardVariants}>
        <div className="relative rounded-[var(--kb-radius-lg)] border border-border/40 p-kb-md px-5 overflow-hidden bg-bg-elevated/60 backdrop-blur-xl">
          {/* 渐变蒙版 */}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-400/[0.06] via-transparent to-accent-400/[0.04] pointer-events-none" />
          {/* Shimmer 扫描 */}
          <div className="absolute inset-0 kb-shimmer pointer-events-none" />
          <div className="relative flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0 animate-pulse shadow-[0_0_6px_rgba(91,138,114,0.5)]" />
            <div>
              <div className="text-[11px] text-brand-500 font-medium flex items-center gap-1 mb-1">
                <Sparkles className="w-3 h-3" /> 今日洞察
              </div>
              <p className="text-[13px] text-text-primary leading-relaxed">
                坚持学习是进步的关键。今天建议优先完成待复习的闪卡，利用间隔重复巩固记忆。
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── 今日概览 — 3D 倾斜卡片 ── */}
      <motion.section className="grid grid-cols-2 lg:grid-cols-4 gap-4" variants={itemVariants}>
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-[var(--kb-radius-lg)] border border-border/30 p-kb-md bg-bg-elevated/40">
                <div className="flex flex-col gap-2">
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="40%" height="2rem" />
                </div>
              </div>
            ))
          : overviewCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <TiltCard
                  key={card.label}
                  className="rounded-[var(--kb-radius-lg)] border border-border/30 bg-bg-elevated/70 backdrop-blur-sm kb-hover-lift group cursor-default"
                >
                  <div className="flex flex-col gap-2 p-kb-md relative">
                    {/* 模块色点 */}
                    <div className={cn('absolute top-3 right-3 w-2 h-2 rounded-full opacity-40 group-hover:opacity-80 transition-opacity duration-300', accentDot[card.accent])} />
                    <div className="flex items-center gap-2">
                      <div className={cn('p-1.5 rounded-[var(--kb-radius-sm)]', accentBg[card.accent])}>
                        <Icon className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                      <span className="text-[12px] text-text-tertiary font-medium">{card.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={cn('text-[28px] font-bold tabular-nums tracking-tight', accentText[card.accent])}>
                        {counters[i]}
                      </span>
                      {card.unit && (
                        <span className="text-[12px] text-text-tertiary">{card.unit}</span>
                      )}
                    </div>
                  </div>
                </TiltCard>
              );
            })}
      </motion.section>

      {/* ── 连续打卡 + 月历 ── */}
      <motion.section className="grid grid-cols-1 lg:grid-cols-3 gap-4" variants={itemVariants}>
        {/* 连续打卡 — 带渐变边框 */}
        <div className="relative rounded-[var(--kb-radius-lg)] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-400/10 via-transparent to-brand-400/10 pointer-events-none" />
          <div className="relative flex flex-col items-center justify-center gap-2 p-kb-lg h-full border border-border/30 rounded-[var(--kb-radius-lg)] bg-bg-elevated/50 backdrop-blur-sm">
            {checkInLoading ? (
              <Skeleton variant="circular" width={48} height={48} />
            ) : (
              <>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Flame className="w-10 h-10 text-accent-400" strokeWidth={1.5} />
                </motion.div>
                <RichTooltip content="连续打卡天数，断签后重置为 1" position="bottom" delay={200}>
                  <span className="text-[32px] font-bold text-accent-400 tabular-nums cursor-help kb-count-animate">
                    {countStreak}
                  </span>
                </RichTooltip>
                <span className="text-[12px] text-text-tertiary">天连续打卡</span>
                <div className={cn(
                  'text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1',
                  todayCheckIn
                    ? 'bg-brand-500/10 text-brand-500'
                    : 'bg-bg-tertiary/50 text-text-tertiary',
                )}>
                  {todayCheckIn ? <><CheckCircle2 className="w-3 h-3" /> 今日已打卡</> : '今日未打卡'}
                </div>
                {/* 冻结卡提示 */}
                <div className="flex items-center gap-1 text-[10px] text-text-tertiary/60 mt-1">
                  <Shield className="w-3 h-3" strokeWidth={1.2} />
                  <span>2 冻结卡可用</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 月历视图 */}
        <div className="lg:col-span-2 rounded-[var(--kb-radius-lg)] border border-border/30 bg-bg-elevated/50 backdrop-blur-sm p-5">
          <h3 className="text-[13px] font-medium text-text-primary mb-3">
            {new Date().getFullYear()}年{new Date().getMonth() + 1}月 打卡日历
          </h3>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
              <div key={w} className="text-center text-[10px] text-text-tertiary font-medium">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.01, duration: 0.2 }}
                className={cn(
                  'aspect-square flex items-center justify-center rounded-[var(--kb-radius-sm)] text-[11px] transition-all duration-200',
                  cell.day === null && 'invisible',
                  cell.day !== null && cell.checked && 'bg-brand-500 text-white font-semibold shadow-[0_0_8px_rgba(91,138,114,0.3)]',
                  cell.day !== null && !cell.checked && 'bg-bg-tertiary/30 text-text-tertiary hover:bg-bg-tertiary/60',
                  cell.isToday && !cell.checked && 'ring-1 ring-brand-400/50 ring-offset-1 ring-offset-bg-primary',
                )}
              >
                {cell.day ?? ''}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── 成就墙 ── */}
      <motion.div variants={cardVariants}>
        <AchievementPanel />
      </motion.div>

      {/* ── 知识星河 ── */}
      <motion.div variants={cardVariants}>
        <div className="rounded-[var(--kb-radius-lg)] border border-border/30 overflow-hidden bg-bg-elevated/50 backdrop-blur-sm">
          <KnowledgeGalaxy points={starPoints} />
        </div>
      </motion.div>

      {/* ── 快速开始 ── */}
      <motion.section className="flex flex-col gap-4" variants={itemVariants}>
        <h2 className="text-[16px] font-semibold text-text-primary">快速开始</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.path}
                onClick={() => navigate(action.path)}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  'group flex flex-col items-center gap-3 rounded-[var(--kb-radius-lg)]',
                  'border border-border/30 bg-bg-elevated/60 backdrop-blur-sm',
                  'p-5 transition-all duration-300',
                  'hover:border-brand-300/40 hover:shadow-[0_8px_24px_-8px_rgba(91,138,114,0.15)]',
                  'active:scale-[0.97]',
                )}
              >
                <div className={cn(
                  'p-3 rounded-[var(--kb-radius-md)] bg-gradient-to-br transition-all duration-300',
                  'group-hover:shadow-[0_0_12px_rgba(91,138,114,0.2)]',
                  action.gradient,
                )}>
                  <Icon className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <span className="text-[13px] font-medium text-text-primary">{action.label}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      {/* ── 最近活动 ── */}
      <motion.section className="flex flex-col gap-4" variants={itemVariants}>
        <h2 className="text-[16px] font-semibold text-text-primary">最近活动</h2>
        {isLoading ? (
          <div className="rounded-[var(--kb-radius-lg)] border border-border/30 bg-bg-elevated/40 p-kb-md">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton variant="circular" width={28} height={28} />
                <Skeleton variant="text" className="flex-1" />
                <Skeleton variant="text" width="60px" />
              </div>
            ))}
          </div>
        ) : recentActivities.length === 0 ? (
          <div className="rounded-[var(--kb-radius-lg)] border border-border/30 bg-bg-elevated/40 overflow-hidden">
            <EmptyState
              icon={<Activity className="w-12 h-12" strokeWidth={1.2} />}
              title="暂无活动记录"
              description="开始学习后，你的活动记录将显示在这里"
            />
          </div>
        ) : (
          <div className="rounded-[var(--kb-radius-lg)] border border-border/30 bg-bg-elevated/50 backdrop-blur-sm overflow-hidden divide-y divide-border/20">
            {recentActivities.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.25 }}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-secondary/40 transition-colors duration-200 group"
                >
                  <div className={cn('p-1.5 rounded-[var(--kb-radius-sm)] shrink-0', accentBg[item.accent], 'group-hover:shadow-[0_0_8px_rgba(91,138,114,0.1)] transition-shadow duration-200')}>
                    <Icon className={cn('w-4 h-4', accentText[item.accent])} strokeWidth={1.5} />
                  </div>
                  <span className="text-[13px] text-text-primary flex-1">{item.text}</span>
                  <span className="text-[11px] text-text-tertiary shrink-0 tabular-nums">{item.time}</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}
