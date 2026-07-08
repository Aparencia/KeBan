import { useState, useEffect, useMemo } from 'react';
import { Clock, Target, Flame, TrendingUp } from 'lucide-react';
import { Card, Skeleton, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import { pomodoroSessionStore } from '@/lib/storage';
import type { PomodoroSession } from '@/types/models';

type TimeRange = 'today' | 'week' | 'month';

const RANGE_LABELS: Record<TimeRange, string> = {
  today: '今日',
  week: '本周',
  month: '本月',
};

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

// Helpers
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  }
  return `${minutes}`;
}

function computeStreak(sessions: PomodoroSession[]): number {
  if (sessions.length === 0) return 0;
  const daySet = new Set(
    sessions.map((s) => getDayKey(new Date(s.completedAt))),
  );
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cursor = new Date(today);
  while (daySet.has(getDayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function PomodoroStatsPage() {
  const [range, setRange] = useState<TimeRange>('today');
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    pomodoroSessionStore
      .getAll()
      .then((data) => setSessions(data))
      .finally(() => setIsLoading(false));
  }, []);

  // Filter sessions by range
  const filteredSessions = useMemo(() => {
    const now = new Date();
    return sessions.filter((s) => {
      const d = new Date(s.completedAt);
      if (range === 'today') return isSameDay(d, now);
      if (range === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
      }
      // month
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return d >= monthAgo;
    });
  }, [sessions, range]);

  // Stats
  const focusTime = useMemo(
    () =>
      formatDuration(
        filteredSessions.reduce((sum, s) => sum + s.actualDuration, 0),
      ),
    [filteredSessions],
  );
  const pomodoroCount = filteredSessions.length;
  const streak = useMemo(() => computeStreak(sessions), [sessions]);

  // Weekly trend: last 7 days
  const weeklyData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: { day: string; hours: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = getDayKey(d);
      const totalSec = sessions
        .filter((s) => getDayKey(new Date(s.completedAt)) === key)
        .reduce((sum, s) => sum + s.actualDuration, 0);
      days.push({ day: DAY_NAMES[d.getDay()], hours: +(totalSec / 3600).toFixed(1) });
    }
    return days;
  }, [sessions]);

  const maxHours = Math.max(...weeklyData.map((d) => d.hours), 0.1);

  // Heatmap: last 91 days (13 weeks x 7 days)
  const heatmap = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Build day->count map
    const countMap = new Map<string, number>();
    sessions.forEach((s) => {
      const key = getDayKey(new Date(s.completedAt));
      countMap.set(key, (countMap.get(key) || 0) + 1);
    });
    // 13 weeks x 7 days = 91 days, arranged as columns of weeks
    const weeks: number[][] = [];
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 90);
    // Align to Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());
    let currentWeek: number[] = [];
    const cursor = new Date(startDate);
    while (cursor <= today) {
      const key = getDayKey(cursor);
      currentWeek.push(countMap.get(key) || 0);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(0);
      weeks.push(currentWeek);
    }
    return weeks;
  }, [sessions]);

  const getIntensityClass = (count: number): string => {
    if (count === 0) return 'bg-bg-tertiary';
    if (count <= 2) return 'bg-pomodoro/20';
    if (count <= 4) return 'bg-pomodoro/40';
    if (count <= 6) return 'bg-pomodoro/60';
    return 'bg-pomodoro';
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-kb-md py-kb-lg">
        <h1 className="text-h1 font-semibold text-text-primary mb-kb-lg">专注统计</h1>
        <div className="grid grid-cols-3 gap-kb-md mb-kb-lg">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} variant="default" padding="md">
              <Skeleton lines={2} height="1.5rem" />
            </Card>
          ))}
        </div>
        <Card variant="default" padding="lg" className="mb-kb-lg">
          <Skeleton variant="rectangular" height="128px" />
        </Card>
        <Card variant="default" padding="lg">
          <Skeleton variant="rectangular" height="100px" />
        </Card>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-kb-md py-kb-lg">
        <h1 className="text-h1 font-semibold text-text-primary mb-kb-lg">专注统计</h1>
        <Card variant="default" padding="lg">
          <EmptyState
            icon={<Clock className="w-12 h-12" strokeWidth={1.2} />}
            title="暂无专注记录"
            description="完成一次番茄钟后，这里会展示你的专注数据统计"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-kb-md py-kb-lg">
      {/* Page title */}
      <h1 className="text-h1 font-semibold text-text-primary mb-kb-lg">专注统计</h1>

      {/* Time range selector - segmented control */}
      <div className="flex items-center gap-kb-xs p-1 bg-bg-secondary rounded-kb-lg border border-border/40 mb-kb-lg w-fit">
        {(['today', 'week', 'month'] as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              'px-4 py-1.5 rounded-kb-md text-b2 font-medium',
              'transition-all duration-kb-fast ease-kb-default',
              'hover:scale-[1.02] active:scale-[0.98]',
              range === r
                ? 'bg-bg-elevated text-text-primary shadow-kb-sm border border-border/30'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-3 gap-kb-md mb-kb-lg">
        <Card variant="default" padding="md">
          <div className="flex flex-col gap-kb-xs">
            <div className="flex items-center gap-1.5 text-text-tertiary">
              <Clock className="w-icon-xs h-icon-xs" strokeWidth={1.5} />
              <span className="text-c1">专注时长</span>
            </div>
            <span className="text-h1 font-semibold text-text-primary font-timer">
              {focusTime}
            </span>
          </div>
        </Card>

        <Card variant="default" padding="md">
          <div className="flex flex-col gap-kb-xs">
            <div className="flex items-center gap-1.5 text-text-tertiary">
              <Target className="w-icon-xs h-icon-xs" strokeWidth={1.5} />
              <span className="text-c1">完成番茄</span>
            </div>
            <span className="text-h1 font-semibold text-text-primary font-timer">
              {pomodoroCount}
            </span>
          </div>
        </Card>

        <Card variant="default" padding="md">
          <div className="flex flex-col gap-kb-xs">
            <div className="flex items-center gap-1.5 text-text-tertiary">
              <Flame className="w-icon-xs h-icon-xs" strokeWidth={1.5} />
              <span className="text-c1">连续天数</span>
            </div>
            <span className="text-h1 font-semibold text-text-primary font-timer">
              {streak}
            </span>
          </div>
        </Card>
      </div>

      {/* Bar chart - weekly focus */}
      <Card variant="default" padding="lg" className="mb-kb-lg">
        <div className="flex items-center gap-2 mb-kb-md">
          <TrendingUp className="w-icon-sm h-icon-sm text-brand-600" strokeWidth={1.5} />
          <h2 className="text-h3 font-medium text-text-primary">本周专注趋势</h2>
        </div>

        <div className="flex items-end justify-between gap-2 h-32">
          {weeklyData.map((d, i) => {
            const heightPct = (d.hours / maxHours) * 100;
            const isToday = i === weeklyData.length - 1;
            return (
              <div key={`${d.day}-${i}`} className="flex flex-col items-center flex-1 gap-1">
                <span className="text-c2 text-text-tertiary">{d.hours}h</span>
                <div
                  className={cn(
                    'w-full rounded-t-kb-sm transition-all duration-kb-normal',
                    isToday
                      ? 'bg-brand-600'
                      : 'bg-brand-200/60',
                  )}
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                />
                <span className="text-c2 text-text-tertiary">{d.day}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Heatmap - focus intensity */}
      <Card variant="default" padding="lg">
        <h2 className="text-h3 font-medium text-text-primary mb-kb-md">专注热力图</h2>

        <div className="overflow-x-auto">
          <div className="flex gap-1 min-w-fit">
            {heatmap.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((count, di) => (
                  <div
                    key={di}
                    className={cn(
                      'w-3 h-3 rounded-[3px] transition-colors duration-kb-fast',
                      getIntensityClass(count),
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-kb-xs mt-kb-sm text-c1 text-text-tertiary">
          <span>少</span>
          <div className="w-3 h-3 rounded-[3px] bg-bg-tertiary" />
          <div className="w-3 h-3 rounded-[3px] bg-pomodoro/20" />
          <div className="w-3 h-3 rounded-[3px] bg-pomodoro/40" />
          <div className="w-3 h-3 rounded-[3px] bg-pomodoro/60" />
          <div className="w-3 h-3 rounded-[3px] bg-pomodoro" />
          <span>多</span>
        </div>
      </Card>
    </div>
  );
}
