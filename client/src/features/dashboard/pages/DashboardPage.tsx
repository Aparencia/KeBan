import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
import { useAuth } from '@/lib/auth/AuthContext';
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

/* ── 氛围文案池（零压力，纯意境） ── */
const ATMOSPHERE_QUOTES: Record<string, string[]> = {
  dawn:    ['晨光微暖，新的一天开始了', '天刚亮，世界还很安静', '清晨的风，带着一点凉意'],
  morning: ['阳光正好，一切刚刚好', '窗外的光，慢慢爬上了桌', '早晨的空气，格外清新'],
  noon:    ['午后的光，刚好照进书桌', '日头正暖，时光慢慢走', '正午的阳光，明亮却不刺眼'],
  evening: ['天色渐柔，适合慢下来', '夕阳把影子拉得很长', '傍晚的风，带着一天故事'],
  night:   ['夜色温柔，属于自己的时间', '星星出来了，世界安静了', '夜晚的光，只为你亮着'],
  late:    ['万籁俱静，世界只剩你和光', '深夜的灯，是最温柔的陪伴', '月亮很高，夜很深'],
};

function getTimePeriod(): string {
  const h = new Date().getHours();
  if (h < 6) return 'late';
  if (h < 9) return 'dawn';
  if (h < 12) return 'morning';
  if (h < 14) return 'noon';
  if (h < 18) return 'evening';
  if (h < 22) return 'night';
  return 'late';
}

/** 基于日期种子选文案，同一天不变 */
function getAtmosphereQuote(): string {
  const period = getTimePeriod();
  const quotes = ATMOSPHERE_QUOTES[period];
  const daySeed = new Date().getDate();
  return quotes[daySeed % quotes.length];
}

/* ─ 打字机 Hook ── */
function useTypewriter(text: string, speed = 60, startDelay = 300) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    const timer = setTimeout(() => {
      let i = 0;
      const id = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(id);
      }, speed);
      return () => clearInterval(id);
    }, startDelay);
    return () => clearTimeout(timer);
  }, [text, speed, startDelay]);
  return displayed;
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

/* ── 弹性翻页 Hook ── */
function useElasticPageTransition() {
  const [offset, setOffset] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const thresholdRef = useRef(0);
  const animatingRef = useRef(false);
  const offsetRef = useRef(0);
  const pageRef = useRef(0);
  const headerOffset = useRef(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerHeightRef = useRef(0);

  // 计算自适应阈值 + header 偏移 + 可用高度
  useEffect(() => {
    const update = () => {
      thresholdRef.current = window.innerHeight * 0.15;
      const el = document.querySelector('[data-elastic-container]');
      if (el) {
        const top = el.getBoundingClientRect().top;
        headerOffset.current = top;
        const h = window.innerHeight - top;
        containerHeightRef.current = h;
        setContainerHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
      }
    };
    update();
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 弹簧弹回动画
  const springBack = useCallback((target: number) => {
    if (animatingRef.current) return;
    animatingRef.current = true;

    // 立即同步页码，防止反向滚动时状态不一致
    pageRef.current = target <= -containerHeightRef.current * 0.5 ? 1 : 0;

    const startTime = performance.now();
    const startOffset = offsetRef.current;
    const duration = 650;

    function easeOutElastic(t: number): number {
      const p = 0.3;
      return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    }

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutElastic(progress);
      const newOffset = startOffset + (target - startOffset) * eased;
      offsetRef.current = newOffset;
      setOffset(newOffset);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        offsetRef.current = target;
        setOffset(target);
        const newPage = target <= -containerHeightRef.current * 0.5 ? 1 : 0;
        setCurrentPage(newPage);
        animatingRef.current = false;
      }
    }
    requestAnimationFrame(step);
  }, []);

  // Wheel 事件处理
  const handleWheel = useCallback((e: WheelEvent) => {
    if (animatingRef.current) {
      e.preventDefault();
      return;
    }

    const delta = e.deltaY;
    const ch = containerHeightRef.current || window.innerHeight;
    const newOffset = Math.max(-ch, Math.min(0, offsetRef.current - delta));
    offsetRef.current = newOffset;
    setOffset(newOffset);

    const threshold = thresholdRef.current;
    const curPage = pageRef.current;

    if (Math.abs(newOffset) >= threshold && curPage === 0) {
      springBack(-ch);
    } else if (newOffset > -ch + threshold && curPage === 1) {
      springBack(0);
    } else if (Math.abs(delta) < 5) {
      springBack(Math.abs(newOffset) > ch * 0.5 ? -ch : 0);
    }

    e.preventDefault();
  }, [springBack]);

  // 绑定/解绑 wheel 事件
  useEffect(() => {
    const container = document.querySelector('[data-elastic-container]');
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  return { offset, currentPage, headerOffset: headerOffset.current, containerHeight, progress: containerHeight > 0 ? Math.min(1, Math.max(0, -offset / containerHeight)) : 0 };
}

/* ── 3D 浮动卡片组件 ── */
function FloatCard3D({ children, className, depth = 1 }: { children: React.ReactNode; className?: string; depth?: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0px)');

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const rotX = -y * 12 * depth;
    const rotY = x * 12 * depth;
    setTransform(`perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(${8 * depth}px)`);
  }, [depth]);

  const handleMouseLeave = useCallback(() => {
    setTransform('perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0px)');
  }, []);

  return (
    <div
      ref={cardRef}
      className={className}
      style={{ transform, transition: 'transform 0.15s ease-out', transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════
   Dashboard 页面组件
   ══════════════════════════════════════════ */
export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const userName = user?.user_metadata?.display_name || user?.email?.split('@')[0];
  const greetingText = useMemo(() => {
    const quote = getAtmosphereQuote();
    return userName ? `${quote} — ${userName}` : quote;
  }, [userName]);
  const typewriterText = useTypewriter(greetingText);

  const { streakDays, todayCheckIn, loading: checkInLoading, loadMonthData } = useCheckIn('dashboard');
  const [monthRecords, setMonthRecords] = useState<StudyCheckIn[]>([]);
  useEffect(() => { loadMonthData().then(setMonthRecords); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    return activities.slice(0, 4);
  }, [pomodoroSessions, notes, feynmanNotes, flashcardReviews]);

  /* ── 计数器 ── */
  const countPomodoro = useCountUp(todayPomodoroCount);
  const countNotes = useCountUp(noteTotal);
  const countFlashcards = useCountUp(dueFlashcardCount);
  const countFeynman = useCountUp(feynmanInProgressCount);
  const countStreak = useCountUp(streakDays);
  const counters = [countPomodoro, countNotes, countFlashcards, countFeynman];

  const { offset, currentPage, headerOffset, containerHeight, progress } = useElasticPageTransition();

  // 鼠标视差追踪（用于页2 3D 效果）
  const mouseParallax = useRef({ x: 0, y: 0 });
  const [parallaxStyle, setParallaxStyle] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseParallax.current = { x, y };
      setParallaxStyle({ x: x * 6, y: y * 6 });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      data-elastic-container
      className="overflow-hidden relative"
      style={{ height: containerHeight || '100%', perspective: '1200px', transformStyle: 'preserve-3d' }}
    >
      {/* ════ 第一页：欢迎 + 洞察 + 概览 ════ */}
      <motion.div
        className="h-full flex flex-col items-center justify-center px-6 relative"
        style={{
          y: offset - headerOffset / 2,
          scale: 1 - progress * 0.12,
          opacity: 1 - progress * 0.4,
          rotateX: `${progress * 6}deg`,
        }}
      >
      {/* ── 背景装饰：微妙的渐变光斑 ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-brand-400/[0.04] blur-3xl kb-ambient-glow" />
        <div className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full bg-accent-400/[0.03] blur-3xl kb-ambient-glow" style={{ animationDelay: '2.5s' }} />
      </div>

      <div className="w-full max-w-[1100px] flex flex-col gap-8">
      {/* ── 欢迎区：玻璃态氛围卡片 ── */}
      <motion.div
        className="relative rounded-[var(--kb-radius-lg)] overflow-hidden border border-border/30 backdrop-blur-xl bg-bg-elevated/40"
        variants={itemVariants}
      >
        {/* 时间氛围光晕 */}
        <div className="absolute inset-0 kb-greeting-glow" />
        {/* 品牌色流光 */}
        <div className="absolute inset-0 kb-greeting-shimmer" />
        {/* 文字内容 */}
        <div className="relative px-8 py-10 flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold text-text-primary tracking-tight min-h-[40px]">
            {typewriterText}
            {typewriterText.length < greetingText.length && (
              <span className="inline-block w-[2px] h-6 bg-text-primary/60 ml-0.5 align-middle animate-pulse" />
            )}
          </h1>
          <p className="text-[14px] text-text-tertiary">{getTodayLabel()}</p>
        </div>
      </motion.div>

      {/* ── AI 洞察卡片 ── */}
      <motion.div variants={cardVariants}>
        <div className="relative rounded-[var(--kb-radius-lg)] border border-border/40 p-5 px-6 overflow-hidden bg-bg-elevated/60 backdrop-blur-xl">
          {/* 渐变蒙版 */}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-400/[0.06] via-transparent to-accent-400/[0.04] pointer-events-none" />
          {/* Shimmer 扫描 */}
          <div className="absolute inset-0 kb-shimmer pointer-events-none" />
          <div className="relative flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0 animate-pulse shadow-[0_0_6px_rgba(91,138,114,0.5)]" />
            <div>
              <div className="text-[12px] text-brand-500 font-medium flex items-center gap-1 mb-1">
                <Sparkles className="w-3.5 h-3.5" /> 今日洞察
              </div>
              <p className="text-[14px] text-text-primary leading-relaxed">
                坚持学习是进步的关键。今天建议优先完成待复习的闪卡，利用间隔重复巩固记忆。
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── 今日概览 — 3D 倾斜卡片 ── */}
      <motion.section className="grid grid-cols-2 lg:grid-cols-4 gap-[clamp(12px,2vw,20px)]" variants={itemVariants}>
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-[var(--kb-radius-lg)] border border-border/30 p-[clamp(12px,1.5vw,16px)] bg-bg-elevated/40">
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
                  <div className="flex flex-col gap-[clamp(8px,1.2vw,12px)] p-[clamp(12px,1.5vw,16px)] relative">
                    {/* 模块色点 */}
                    <div className={cn('absolute top-3 right-3 w-2.5 h-2.5 rounded-full opacity-40 group-hover:opacity-80 transition-opacity duration-300', accentDot[card.accent])} />
                    <div className="flex items-center gap-2">
                      <div className={cn('p-[clamp(6px,0.8vw,8px)] rounded-[var(--kb-radius-sm)]', accentBg[card.accent])}>
                        <Icon className="w-[clamp(16px,2vw,20px)] h-[clamp(16px,2vw,20px)]" strokeWidth={1.5} />
                      </div>
                      <span className="text-[clamp(11px,1.2vw,13px)] text-text-tertiary font-medium">{card.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={cn('font-bold tabular-nums tracking-tight text-[clamp(24px,3.5vw,36px)]', accentText[card.accent])}>
                        {counters[i]}
                      </span>
                      {card.unit && (
                        <span className="text-[clamp(11px,1.2vw,13px)] text-text-tertiary">{card.unit}</span>
                      )}
                    </div>
                  </div>
                </TiltCard>
              );
            })}
      </motion.section>
      </div>{/* end page-1 content wrapper */}
      </motion.div>{/* end page 1 */}

      {/* ════ 第二页：详细内容 ════ */}
      <motion.div
        className="absolute inset-0 px-6 py-3 overflow-hidden"
        style={{
          y: offset + containerHeight,
          scale: 0.88 + progress * 0.12,
          opacity: 0.3 + progress * 0.7,
          rotateX: `${-6 + progress * 6}deg`,
        }}
      >
      <div className="max-w-[1100px] mx-auto flex flex-col gap-2.5 h-full overflow-hidden" style={{ transform: `translate(${parallaxStyle.x}px, ${parallaxStyle.y}px)`, transition: 'transform 0.3s ease-out' }}>

      {/* Row 1: Check-in + Calendar */}
      <div className="grid grid-cols-[180px_1fr] gap-2.5">
        {/* Check-in streak */}
        <FloatCard3D depth={1.5}>
        <motion.div variants={itemVariants} className="relative rounded-[var(--kb-radius-lg)] overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-400/10 via-transparent to-brand-400/10 pointer-events-none" />
          <div className="relative flex flex-col items-center justify-center gap-0.5 p-3 border border-border/30 rounded-[var(--kb-radius-lg)] bg-bg-elevated/50 backdrop-blur-sm transition-all duration-300 group-hover:border-accent-400/30 group-hover:shadow-[0_0_20px_rgba(251,146,60,0.08)]">
            {checkInLoading ? (
              <Skeleton variant="circular" width={48} height={48} />
            ) : (
              <>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Flame className="w-5 h-5 text-accent-400" strokeWidth={1.5} />
                </motion.div>
                <RichTooltip content="连续打卡天数，断签后重置为 1" position="bottom" delay={200}>
                  <span className="text-[24px] font-bold text-accent-400 tabular-nums cursor-help kb-count-animate">
                    {countStreak}
                  </span>
                </RichTooltip>
                <span className="text-[10px] text-text-tertiary">天连续打卡</span>
                <div className={cn(
                  'text-[9px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1',
                  todayCheckIn
                    ? 'bg-brand-500/10 text-brand-500'
                    : 'bg-bg-tertiary/50 text-text-tertiary',
                )}>
                  {todayCheckIn ? <><CheckCircle2 className="w-2.5 h-2.5" /> 今日已打卡</> : '今日未打卡'}
                </div>
                <div className="flex items-center gap-1 text-[8px] text-text-tertiary/60 mt-0.5">
                  <Shield className="w-2.5 h-2.5" strokeWidth={1.2} />
                  <span>2 冻结卡可用</span>
                </div>
              </>
            )}
          </div>
        </motion.div>
        </FloatCard3D>

        {/* Calendar */}
        <FloatCard3D depth={1}>
        <motion.div variants={cardVariants} className="rounded-[var(--kb-radius-lg)] border border-border/30 bg-bg-elevated/50 backdrop-blur-sm p-2.5">
          <h3 className="text-[10px] font-medium text-text-primary mb-1">
            {new Date().getFullYear()}年{new Date().getMonth() + 1}月 打卡日历
          </h3>
          <div className="grid grid-cols-7 gap-0.5 mb-0.5">
            {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
              <div key={w} className="text-center text-[7px] text-text-tertiary font-medium">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((cell, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.005, duration: 0.15 }}
                className={cn(
                  'h-[22px] flex items-center justify-center rounded-[var(--kb-radius-sm)] text-[8px] transition-all duration-200',
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
        </motion.div>
        </FloatCard3D>
      </div>{/* end row 1 */}

      {/* Row 2: Achievement + Knowledge Galaxy */}
      <div className="grid grid-cols-2 gap-2.5">
        <FloatCard3D depth={0.8}>
        <motion.div variants={cardVariants} className="rounded-[var(--kb-radius-lg)] border border-border/30 bg-bg-elevated/50 backdrop-blur-sm overflow-hidden">
          <AchievementPanel />
        </motion.div>
        </FloatCard3D>

        <FloatCard3D depth={1.2}>
        <motion.div variants={cardVariants} className="rounded-[var(--kb-radius-lg)] border border-border/30 overflow-hidden bg-bg-elevated/50 backdrop-blur-sm">
          <KnowledgeGalaxy points={starPoints} />
        </motion.div>
        </FloatCard3D>
      </div>{/* end row 2 */}

      {/* Row 3: Quick start + Recent activity */}
      <div className="grid grid-cols-[200px_1fr] gap-2.5">
        {/* Quick start */}
        <FloatCard3D depth={0.8}>
        <motion.section className="flex flex-col gap-1.5" variants={itemVariants}>
          <h2 className="text-[11px] font-semibold text-text-primary">快速开始</h2>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  whileHover={{ y: -3, scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className={cn(
                    'group flex flex-col items-center gap-2 rounded-[var(--kb-radius-lg)]',
                    'border border-border/30 bg-bg-elevated/60 backdrop-blur-sm',
                    'p-2 transition-all duration-300',
                    'hover:border-brand-300/40 hover:shadow-[0_8px_24px_-8px_rgba(91,138,114,0.15)]',
                    'active:scale-[0.97]',
                  )}
                >
                  <div className={cn(
                    'p-1.5 rounded-[var(--kb-radius-md)] bg-gradient-to-br transition-all duration-300',
                    'group-hover:shadow-[0_0_12px_rgba(91,138,114,0.2)]',
                    action.gradient,
                  )}>
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] font-medium text-text-primary">{action.label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.section>
        </FloatCard3D>

        {/* Recent activity */}
        <FloatCard3D depth={0.6}>
        <motion.section className="flex flex-col gap-1.5" variants={itemVariants}>
          <h2 className="text-[11px] font-semibold text-text-primary">最近活动</h2>
          {isLoading ? (
            <div className="rounded-[var(--kb-radius-lg)] border border-border/30 bg-bg-elevated/40 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
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
                icon={<Activity className="w-10 h-10" strokeWidth={1.2} />}
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
                    className="flex items-center gap-3 px-3 py-1.5 hover:bg-bg-secondary/40 transition-colors duration-200 group"
                  >
                    <div className={cn('p-1.5 rounded-[var(--kb-radius-sm)] shrink-0', accentBg[item.accent], 'group-hover:shadow-[0_0_8px_rgba(91,138,114,0.1)] transition-shadow duration-200')}>
                      <Icon className={cn('w-3.5 h-3.5', accentText[item.accent])} strokeWidth={1.5} />
                    </div>
                    <span className="text-[12px] text-text-primary flex-1 truncate">{item.text}</span>
                    <span className="text-[10px] text-text-tertiary shrink-0 tabular-nums">{item.time}</span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>
        </FloatCard3D>
      </div>{/* end bottom row */}
      </div>{/* end page-2 content wrapper */}
      </motion.div>{/* end page 2 */}
    </div>
  );
}
