import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Timer,
  FileText,
  Layers,
  Lightbulb,
  CheckCircle2,
  Activity,
  PenLine,
  Brain,
} from 'lucide-react';
import { Card, Skeleton, EmptyState } from '@/components/ui';
import { pomodoroSessionStore, flashcardStore, flashcardReviewStore } from '@/lib/storage';
import { useFlashcardStore } from '@/features/flashcards/store/useFlashcardStore';
import { useNoteStore } from '@/features/notes/store/useNoteStore';
import { useFeynmanStore } from '@/features/feynman/store/useFeynmanStore';
import type { PomodoroSession, Flashcard, FlashcardReview } from '@/types/models';

/* ---- 工具函数 ---- */

const accentText: Record<string, string> = {
  pomodoro: 'text-pomodoro',
  note: 'text-note',
  flashcard: 'text-flashcard',
  feynman: 'text-feynman',
};

const accentBg: Record<string, string> = {
  pomodoro: 'bg-pomodoro/10',
  note: 'bg-note/10',
  flashcard: 'bg-flashcard/10',
  feynman: 'bg-feynman/10',
};

const accentBar: Record<string, string> = {
  pomodoro: 'bg-pomodoro',
  note: 'bg-note',
  flashcard: 'bg-flashcard',
  feynman: 'bg-feynman',
};

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

/* ---- 活动条目类型 ---- */

interface ActivityItem {
  icon: typeof Timer;
  text: string;
  time: string;
  accent: string;
  timestamp: number;
}

/* ---- 快速操作（静态） ---- */

const quickActions = [
  { label: '番茄钟', icon: Timer, path: '/pomodoro', accent: 'pomodoro' as const },
  { label: '智能笔记', icon: FileText, path: '/notes', accent: 'note' as const },
  { label: '闪卡', icon: Layers, path: '/flashcards', accent: 'flashcard' as const },
  { label: '费曼学习', icon: Lightbulb, path: '/feynman', accent: 'feynman' as const },
];

/* ---- 页面组件 ---- */

export default function DashboardPage() {
  const navigate = useNavigate();

  // 闪卡 store
  const loadDecks = useFlashcardStore((s) => s.loadDecks);

  // 笔记 store
  const notes = useNoteStore((s) => s.notes);
  const loadNotes = useNoteStore((s) => s.loadNotes);

  // 费曼 store
  const feynmanNotes = useFeynmanStore((s) => s.notes);
  const loadFeynmanNotes = useFeynmanStore((s) => s.loadNotes);

  // 本地状态
  const [isLoading, setIsLoading] = useState(true);
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([]);
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [flashcardReviews, setFlashcardReviews] = useState<FlashcardReview[]>([]);

  // 并行加载所有数据
  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      loadDecks(),
      loadNotes(),
      loadFeynmanNotes(),
      pomodoroSessionStore.getAll().then((sessions) => {
        setPomodoroSessions(sessions as PomodoroSession[]);
      }),
      flashcardStore.getAll().then((cards) => {
        setAllCards(cards as Flashcard[]);
      }),
      flashcardReviewStore.getAll().then((reviews) => {
        setFlashcardReviews(reviews as FlashcardReview[]);
      }),
    ]).finally(() => {
      setIsLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 计算概览数据 ──

  const todayPomodoroCount = useMemo(() => {
    const today = new Date().toDateString();
    return pomodoroSessions.filter(
      (s) => new Date(s.completedAt).toDateString() === today,
    ).length;
  }, [pomodoroSessions]);

  const noteTotal = notes.length;

  const dueFlashcardCount = useMemo(() => {
    const now = new Date();
    return allCards.filter((c) => new Date(c.dueDate) <= now).length;
  }, [allCards]);

  const feynmanInProgressCount = useMemo(() => {
    return feynmanNotes.filter((n) => n.status === 'in_progress').length;
  }, [feynmanNotes]);

  // ── 概览卡片配置 ──

  const overviewCards = [
    {
      label: '今日番茄',
      value: String(todayPomodoroCount),
      unit: '个',
      icon: Timer,
      accent: 'pomodoro' as const,
    },
    {
      label: '笔记总数',
      value: String(noteTotal),
      unit: '篇',
      icon: FileText,
      accent: 'note' as const,
    },
    {
      label: '待复习闪卡',
      value: String(dueFlashcardCount),
      unit: '张',
      icon: Layers,
      accent: 'flashcard' as const,
    },
    {
      label: '费曼进行中',
      value: String(feynmanInProgressCount),
      unit: '个',
      icon: Lightbulb,
      accent: 'feynman' as const,
    },
  ];

  // ── 合并最近活动 ──

  const recentActivities = useMemo(() => {
    const activities: ActivityItem[] = [];

    // 番茄钟会话
    pomodoroSessions.forEach((s) => {
      const d = new Date(s.completedAt);
      const minutes = Math.round(s.actualDuration / 60);
      activities.push({
        icon: CheckCircle2,
        text: `完成了 ${minutes} 分钟番茄钟`,
        time: formatRelativeTime(d),
        accent: 'pomodoro',
        timestamp: d.getTime(),
      });
    });

    // 笔记更新
    notes.forEach((n) => {
      const d = new Date(n.updatedAt);
      activities.push({
        icon: PenLine,
        text: `笔记「${n.title || '无标题'}」`,
        time: formatRelativeTime(d),
        accent: 'note',
        timestamp: d.getTime(),
      });
    });

    // 费曼笔记更新
    feynmanNotes.forEach((fn) => {
      const d = new Date(fn.updatedAt);
      activities.push({
        icon: Brain,
        text: `费曼学习「${fn.concept}」`,
        time: formatRelativeTime(d),
        accent: 'feynman',
        timestamp: d.getTime(),
      });
    });

    // 闪卡复习记录
    flashcardReviews.slice(0, 20).forEach((review) => {
      const d = new Date(review.reviewedAt);
      const ratingLabel = ['Again', 'Hard', 'Good', 'Easy'][review.rating - 1] ?? '';
      activities.push({
        icon: Layers,
        text: `复习了闪卡（${ratingLabel}）`,
        time: formatRelativeTime(d),
        accent: 'flashcard',
        timestamp: d.getTime(),
      });
    });

    // 按时间倒序，取最近 8 条
    activities.sort((a, b) => b.timestamp - a.timestamp);
    return activities.slice(0, 8);
  }, [pomodoroSessions, notes, feynmanNotes, flashcardReviews]);

  // ── 渲染 ──

  return (
    <div className="px-kb-lg py-kb-xl max-w-6xl mx-auto flex flex-col gap-kb-xl">
      {/* ── 顶部欢迎区 ── */}
      <header className="flex flex-col gap-kb-xs">
        <h1 className="text-d2 font-bold text-text-primary tracking-tight">
          你好，开始今天的学习吧
        </h1>
        <p className="text-b2 text-text-tertiary">{getTodayLabel()}</p>
      </header>

      {/* ── 今日概览 ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-kb-md">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card
                key={i}
                variant="default"
                padding="none"
                className="relative overflow-hidden"
              >
                <div className="flex flex-col gap-kb-sm p-kb-md pl-kb-lg">
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="40%" height="2rem" />
                </div>
              </Card>
            ))
          : overviewCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card
                  key={card.label}
                  variant="default"
                  padding="none"
                  className="group relative overflow-hidden hover:-translate-y-0.5 hover:shadow-kb-md transition-all duration-kb-normal ease-kb-default"
                >
                  {/* 左侧色条 */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-kb-lg ${accentBar[card.accent]}`}
                  />
                  <div className="flex flex-col gap-kb-sm p-kb-md pl-kb-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-b3 text-text-tertiary font-medium">
                        {card.label}
                      </span>
                      <div className={`p-1.5 rounded-kb-md ${accentBg[card.accent]}`}>
                        <Icon className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-h1 font-bold tabular-nums ${accentText[card.accent]}`}
                      >
                        {card.value}
                      </span>
                      {card.unit && (
                        <span className="text-b3 text-text-tertiary">{card.unit}</span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
      </section>

      {/* ── 快速开始 ── */}
      <section className="flex flex-col gap-kb-md">
        <h2 className="text-h2 font-semibold text-text-primary">快速开始</h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-kb-md">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className={`
                  group flex flex-col items-center gap-kb-sm
                  bg-bg-elevated border border-border/50 rounded-kb-xl
                  p-kb-lg
                  transition-all duration-kb-normal ease-kb-default
                  hover:-translate-y-0.5 hover:shadow-kb-md hover:border-brand-300/60
                  active:scale-[0.98]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40
                `}
              >
                <div
                  className={`p-3 rounded-kb-lg ${accentBg[action.accent]} transition-colors duration-kb-normal`}
                >
                  <Icon className="w-icon-lg h-icon-lg" strokeWidth={1.5} />
                </div>
                <span className="text-b2 font-medium text-text-primary">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 最近活动 ── */}
      <section className="flex flex-col gap-kb-md">
        <h2 className="text-h2 font-semibold text-text-primary">最近活动</h2>

        {isLoading ? (
          <Card variant="default" padding="none" className="overflow-hidden">
            <div className="flex flex-col divide-y divide-border/40">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-kb-md px-kb-md py-kb-sm">
                  <Skeleton variant="circular" width={28} height={28} />
                  <Skeleton variant="text" className="flex-1" />
                  <Skeleton variant="text" width="60px" />
                </div>
              ))}
            </div>
          </Card>
        ) : recentActivities.length === 0 ? (
          <Card variant="default" padding="none" className="overflow-hidden">
            <EmptyState
              icon={<Activity className="w-12 h-12" strokeWidth={1.2} />}
              title="暂无活动记录"
              description="开始学习后，你的活动记录将显示在这里"
            />
          </Card>
        ) : (
          <Card variant="default" padding="none" className="overflow-hidden">
            <ul className="divide-y divide-border/40">
              {recentActivities.map((item, i) => {
                const Icon = item.icon;
                return (
                  <li
                    key={i}
                    className="flex items-center gap-kb-md px-kb-md py-kb-sm transition-colors duration-kb-fast hover:bg-bg-secondary/60"
                  >
                    <div className={`p-1.5 rounded-kb-md shrink-0 ${accentBg[item.accent]}`}>
                      <Icon
                        className={`w-icon-sm h-icon-sm ${accentText[item.accent]}`}
                        strokeWidth={1.5}
                      />
                    </div>
                    <span className="text-b2 text-text-primary flex-1">{item.text}</span>
                    <span className="text-b3 text-text-tertiary shrink-0">{item.time}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
