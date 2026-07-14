import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import {
  Timer, FileText, Layers, Lightbulb, CheckCircle2,
  Activity, PenLine, Brain, Sparkles, Clock,
} from 'lucide-react';
import { Card, Skeleton } from '@/components/ui';
import type { StarPoint } from '@/components/ui/KnowledgeGalaxy';
import { cn } from '@/lib/utils';
import { pomodoroSessionStore, flashcardStore, flashcardReviewStore, appSettingsStore } from '@/lib/storage';
import { useFlashcardStore } from '@/features/flashcards/store/useFlashcardStore';
import { useNoteStore } from '@/features/notes/store/useNoteStore';
import { useFeynmanStore } from '@/features/feynman/store/useFeynmanStore';
import { useCheckIn } from '@/lib/checkin/useCheckIn';
import { useAuth } from '@/lib/auth/AuthContext';
import StartupRitual from '../components/StartupRitual';
import { useLastSession } from '../hooks/useLastSession';
import type { MicroGoal, RitualSettings } from '../types';
import type { PomodoroSession, Flashcard, FlashcardReview, StudyCheckIn } from '@/types/models';
import HeatmapChart from '../components/HeatmapChart';
import { useLearningAnalytics } from '../hooks/useLearningAnalytics';
// 深海组件
import DeepSeaContainer from '../components/deep-sea/DeepSeaContainer';
import BubbleStreak from '../components/deep-sea/creatures/BubbleStreak';
import CoralReefCalendar from '../components/deep-sea/creatures/CoralReefCalendar';
import AnglerfishAchievements from '../components/deep-sea/creatures/AnglerfishAchievements';
import NeuronGalaxy from '../components/deep-sea/creatures/NeuronGalaxy';
import JellyfishRadar from '../components/deep-sea/creatures/JellyfishRadar';
import JellyfishTrend from '../components/deep-sea/creatures/JellyfishTrend';
import PlanktonStream from '../components/deep-sea/creatures/PlanktonStream';
import PearlGoal from '../components/deep-sea/creatures/PearlGoal';

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
  { label: '深潜', icon: Timer, path: '/pomodoro', accent: 'pomodoro' as const, gradient: 'from-brand-400/20 to-brand-600/10' },
  { label: '结礁', icon: FileText, path: '/notes', accent: 'note' as const, gradient: 'from-note/20 to-note/5' },
  { label: '反衰减呼吸', icon: Layers, path: '/flashcards', accent: 'flashcard' as const, gradient: 'from-flashcard/20 to-flashcard/5' },
  { label: '浮出水面', icon: Lightbulb, path: '/feynman', accent: 'feynman' as const, gradient: 'from-feynman/20 to-feynman/5' },
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

/* ══════════════════════════════════════════
   Dashboard 页面组件
   ══════════════════════════════════════════ */
/* ── 工具：获取今天日期字符串 YYYY-MM-DD ── */
function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  /* ── 学习启动仪式状态 ── */
  const [showRitual, setShowRitual] = useState(false);
  const lastSession = useLastSession();

  useEffect(() => {
    (async () => {
      try {
        const settings = await appSettingsStore.getAll();
        const ritualRow = settings.find((s) => s.key === 'startupRitual');
        const ritual: RitualSettings | undefined = ritualRow
          ? JSON.parse(ritualRow.value)
          : undefined;
        if (ritual?.enabled === false) return;
        if (ritual?.skipToday && ritual?.lastRitualDate === getTodayStr()) return;
        if (ritual?.lastRitualDate === getTodayStr()) return;
        setShowRitual(true);
      } catch {
        // 首次使用，无设置记录，显示仪式
        setShowRitual(true);
      }
    })();
  }, []);

  const handleRitualComplete = useCallback(async (goal?: MicroGoal) => {
    const today = getTodayStr();
    const ritualValue: RitualSettings = { enabled: true, lastRitualDate: today, skipToday: false };
    try {
      const settings = await appSettingsStore.getAll();
      const ritualRow = settings.find((s) => s.key === 'startupRitual');
      if (ritualRow) {
        await appSettingsStore.update(ritualRow.id, { value: JSON.stringify(ritualValue), updatedAt: new Date() });
      } else {
        await appSettingsStore.create({
          id: `startupRitual-${Date.now()}`,
          key: 'startupRitual',
          value: JSON.stringify(ritualValue),
          updatedAt: new Date(),
        });
      }
    } catch { /* 静默 */ }
    void goal; // 微目标暂不持久化，留给后续扩展
    setShowRitual(false);
  }, []);

  const handleRitualSkip = useCallback(async () => {
    setShowRitual(false);
  }, []);

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
  const [analyticsDays, setAnalyticsDays] = useState(30);
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
    { label: '今日深潜', value: todayPomodoroCount, unit: '个', icon: Timer, accent: 'pomodoro' as const },
    { label: '结礁总数', value: noteTotal, unit: '篇', icon: FileText, accent: 'note' as const },
    { label: '反衰减呼吸', value: dueFlashcardCount, unit: '张', icon: Layers, accent: 'flashcard' as const },
    { label: '浮出水面进行中', value: feynmanInProgressCount, unit: '个', icon: Lightbulb, accent: 'feynman' as const },
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
      activities.push({ icon: CheckCircle2, text: `完成了 ${Math.round(s.actualDuration / 60)} 分钟深潜`, time: formatRelativeTime(d), accent: 'pomodoro', timestamp: d.getTime() });
    });
    notes.forEach((n) => {
      const d = new Date(n.updatedAt);
      activities.push({ icon: PenLine, text: `结礁「${n.title || '无标题'}」`, time: formatRelativeTime(d), accent: 'note', timestamp: d.getTime() });
    });
    feynmanNotes.forEach((fn) => {
      const d = new Date(fn.updatedAt);
      activities.push({ icon: Brain, text: `浮出水面「${fn.concept}」`, time: formatRelativeTime(d), accent: 'feynman', timestamp: d.getTime() });
    });
    flashcardReviews.slice(0, 20).forEach((review) => {
      const d = new Date(review.reviewedAt);
      const ratingLabel = ['Again', 'Hard', 'Good', 'Easy'][review.rating - 1] ?? '';
      activities.push({ icon: Layers, text: `复习了反衰减呼吸（${ratingLabel}）`, time: formatRelativeTime(d), accent: 'flashcard', timestamp: d.getTime() });
    });
    activities.sort((a, b) => b.timestamp - a.timestamp);
    return activities.slice(0, 4);
  }, [pomodoroSessions, notes, feynmanNotes, flashcardReviews]);

  /* ── 计数器 ── */
  const countPomodoro = useCountUp(todayPomodoroCount);
  const countNotes = useCountUp(noteTotal);
  const countFlashcards = useCountUp(dueFlashcardCount);
  const countFeynman = useCountUp(feynmanInProgressCount);
  const counters = [countPomodoro, countNotes, countFlashcards, countFeynman];

  const { offset, currentPage, headerOffset, containerHeight, progress } = useElasticPageTransition();
  const { data: analytics, loading: analyticsLoading } = useLearningAnalytics(analyticsDays);

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

  // 页2 内部滚动：允许分析区域独立滚动，阻止弹性翻页拦截
  useEffect(() => {
    const el = document.querySelector('[data-dashboard-scroll]') as HTMLElement | null;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      const page2 = currentPage === 1;
      const canDown = el.scrollTop < el.scrollHeight - el.clientHeight - 2;
      const canUp = el.scrollTop > 2;
      if (page2 && ((e.deltaY > 0 && canDown) || (e.deltaY < 0 && canUp))) {
        e.stopPropagation();
      }
    };
    el.addEventListener('wheel', handler, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', handler, true);
  }, [currentPage]);

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

      {/* ════ 第二页：深海认知景深层 ════ */}
      <motion.div
        className="absolute inset-0 overflow-hidden"
        style={{
          y: offset + containerHeight,
          scale: 0.88 + progress * 0.12,
          opacity: 0.3 + progress * 0.7,
          rotateX: `${-6 + progress * 6}deg`,
        }}
      >
        <DeepSeaContainer
          elasticProgress={progress}
          layers={[
            {
              zone: 'surface' as const,
              label: '海面 -- 今日核心',
              children: (
                <div className="flex flex-col gap-2.5">
                  {/* Row 1: 气泡柱 + 珊瑚礁日历 */}
                  <div className="grid grid-cols-[160px_1fr] gap-2.5">
                    <BubbleStreak streakDays={streakDays} todayChecked={todayCheckIn} loading={checkInLoading} />
                    <CoralReefCalendar days={calendarDays} month={new Date().getMonth()} year={new Date().getFullYear()} />
                  </div>
                  {/* Row 2: 快速开始 */}
                  <motion.section className="flex flex-col gap-1.5" variants={itemVariants}>
                    <h2 className="text-[11px] font-semibold text-cyan-200/70">快速开始</h2>
                    <div className="grid grid-cols-4 gap-2">
                      {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                          <motion.button
                            key={action.path}
                            onClick={() => navigate(action.path)}
                            whileHover={{ y: -2, scale: 1.03 }}
                            whileTap={{ scale: 0.96 }}
                            className={cn(
                              'group flex flex-col items-center gap-1.5 rounded-[var(--kb-radius-lg)]',
                              'border border-cyan-400/15 bg-bg-elevated/30 backdrop-blur-sm',
                              'p-2 transition-all duration-300',
                              'hover:border-cyan-400/30 hover:shadow-[0_0_16px_rgba(34,211,238,0.08)]',
                            )}
                          >
                            <div className={cn('p-1.5 rounded-[var(--kb-radius-sm)] bg-gradient-to-br transition-all duration-300', action.gradient)}>
                              <Icon className="w-4 h-4" strokeWidth={1.5} />
                            </div>
                            <span className="text-[10px] font-medium text-cyan-200/70">{action.label}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.section>
                </div>
              ),
            },
            {
              zone: 'sunlight' as const,
              label: '透光层 -- 近期活跃',
              children: (
                <div className="grid grid-cols-2 gap-2.5">
                  <JellyfishRadar data={analytics?.radar ?? []} loading={analyticsLoading} />
                  <JellyfishTrend data={analytics?.trend ?? []} loading={analyticsLoading} />
                </div>
              ),
            },
            {
              zone: 'twilight' as const,
              label: '中层 -- 知识结构',
              children: (
                <div className="flex flex-col gap-2.5">
                  {/* 学习分析 -- 时间范围控制 */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-semibold text-cyan-200/70 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-cyan-400/60" strokeWidth={1.5} />
                      学习分析
                    </h2>
                    <div className="flex gap-0.5 rounded-[8px] bg-bg-tertiary/20 p-0.5">
                      {[{ l: '7天', d: 7 }, { l: '30天', d: 30 }, { l: '全部', d: 3650 }].map((r) => (
                        <button
                          key={r.d}
                          onClick={() => setAnalyticsDays(r.d)}
                          className={cn(
                            'px-2 py-0.5 rounded-[6px] text-[9px] font-medium transition-all duration-200',
                            analyticsDays === r.d
                              ? 'bg-cyan-400/20 text-cyan-200'
                              : 'text-text-tertiary/60 hover:text-cyan-200/60',
                          )}
                        >
                          {r.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <NeuronGalaxy points={starPoints} />
                  <div className="rounded-[var(--kb-radius-lg)] border border-cyan-400/15 bg-bg-elevated/20 backdrop-blur-sm p-3">
                    <h3 className="text-[10px] font-medium text-cyan-200/60 mb-2">学习热力图</h3>
                    <HeatmapChart data={analytics?.heatmap ?? []} loading={analyticsLoading} />
                  </div>
                  {/* 智能时段推荐 */}
                  {analytics?.recommendations?.length ? (
                    <div className="grid grid-cols-3 gap-2">
                      {analytics.recommendations.map((rec, i) => (
                        <div key={i} className="rounded-[var(--kb-radius-lg)] border border-cyan-400/10 bg-bg-elevated/20 backdrop-blur-sm p-2.5 transition-all duration-300 hover:border-cyan-400/25">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Clock className="w-3 h-3 text-cyan-400/60" strokeWidth={1.5} />
                            <span className="text-[9px] font-semibold text-cyan-300/60">推荐时段</span>
                            <span className="text-[8px] text-text-tertiary/40">{rec.score}%</span>
                          </div>
                          <p className="text-[10px] text-text-primary/70 leading-relaxed">{rec.reason}</p>
                          <div className="mt-1.5 h-1 rounded-full bg-bg-tertiary/20 overflow-hidden">
                            <div className="h-full rounded-full bg-cyan-400/40 transition-all duration-500" style={{ width: `${rec.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ),
            },
            {
              zone: 'midnight' as const,
              label: '深渊 -- 长期沉淀',
              children: (
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <AnglerfishAchievements />
                    <PlanktonStream
                      activities={recentActivities.map((a) => ({ icon: a.icon, text: a.text, time: a.time, accent: a.accent, timestamp: a.timestamp }))}
                      loading={isLoading}
                    />
                  </div>
                  <PearlGoal goals={analytics?.goals ?? []} loading={analyticsLoading} />
                </div>
              ),
            },
          ]}
        />
      </motion.div>{/* end page 2 */}

      {/* ══ 学习启动仪式模态层 ══ */}
      {showRitual && (
        <StartupRitual
          onComplete={handleRitualComplete}
          onSkip={handleRitualSkip}
          lastSession={lastSession}
        />
      )}
    </div>
  );
}
