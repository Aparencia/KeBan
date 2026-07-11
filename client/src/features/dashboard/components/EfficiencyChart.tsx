import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { PomodoroSession, FlashcardReview, FeynmanNote, StudyCheckIn } from '@/types/models';
import { Card } from '@/components/ui/Card';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EfficiencyData {
  pomodoroSessions: PomodoroSession[];
  flashcardReviews: FlashcardReview[];
  feynmanNotes: FeynmanNote[];
  studyCheckIns: StudyCheckIn[];
}

// ─── Color tokens ────────────────────────────────────────────────────────────

const BRAND_500 = '#FF7F50';
const SUCCESS_500 = '#66D9A0';
const WARNING_500 = '#FFB84D';
const ERROR_500 = '#FF6B6B';
const PIE_COLORS = [BRAND_500, SUCCESS_500, WARNING_500, ERROR_500];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().split('T')[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function shortLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

// ─── Sub-component: Study Trend Line Chart ───────────────────────────────────

function StudyTrendChart({ sessions }: { sessions: PomodoroSession[] }) {
  const data = useMemo(() => {
    const cutoff = daysAgo(30);
    const map = new Map<string, number>();

    // Pre-fill all 30 days with 0
    for (let i = 29; i >= 0; i--) {
      map.set(daysAgo(i), 0);
    }

    sessions.forEach((s) => {
      const dateStr = toDateStr(s.completedAt);
      if (dateStr >= cutoff) {
        map.set(dateStr, (map.get(dateStr) ?? 0) + s.actualDuration);
      }
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, seconds]) => ({
        date: shortLabel(date),
        minutes: Math.round(seconds / 60),
      }));
  }, [sessions]);

  return (
    <Card variant="elevated" padding="lg">
      <h3 className="text-h2 text-text-primary mb-kb-md">学习趋势（近 30 天）</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v: number) => `${v}m`}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value} 分钟`, '学习时长']}
            />
            <Line
              type="monotone"
              dataKey="minutes"
              stroke={BRAND_500}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: BRAND_500 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ─── Sub-component: Module Time Pie Chart ────────────────────────────────────

function ModuleTimePieChart({
  sessions,
  reviews,
  feynmanNotes,
}: {
  sessions: PomodoroSession[];
  reviews: FlashcardReview[];
  feynmanNotes: FeynmanNote[];
}) {
  const data = useMemo(() => {
    const pomodoroMin = sessions.reduce((sum, s) => sum + s.actualDuration, 0) / 60;

    const flashcardMin = reviews.reduce((sum, r) => sum + (r.timeSpent ?? 0), 0) / 60;

    const feynmanMin = feynmanNotes.reduce((sum, n) => {
      const created = new Date(n.createdAt).getTime();
      const updated = new Date(n.updatedAt).getTime();
      const diffSec = Math.max(0, (updated - created) / 1000);
      return sum + diffSec;
    }, 0) / 60;

    return [
      { name: '番茄钟', value: Math.round(pomodoroMin) },
      { name: '闪卡复习', value: Math.round(flashcardMin) },
      { name: '费曼学习', value: Math.round(feynmanMin) },
    ].filter((d) => d.value > 0);
  }, [sessions, reviews, feynmanNotes]);

  if (data.length === 0) {
    return (
      <Card variant="elevated" padding="lg">
        <h3 className="text-h2 text-text-primary mb-kb-md">模块时间占比</h3>
        <div className="h-64 flex items-center justify-center">
          <span className="text-b2 text-text-tertiary">暂无数据</span>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="elevated" padding="lg">
      <h3 className="text-h2 text-text-primary mb-kb-md">模块时间占比</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value: string) => <span className="text-b2 text-text-secondary">{value}</span>}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value} 分钟`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ─── Sub-component: Check-In Heatmap ─────────────────────────────────────────

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function getHeatColor(moduleCount: number): string {
  if (moduleCount === 0) return 'bg-bg-tertiary';
  if (moduleCount <= 1) return 'bg-brand-200';
  if (moduleCount <= 2) return 'bg-brand-400';
  return 'bg-brand-600';
}

function CheckInHeatmap({ checkIns }: { checkIns: StudyCheckIn[] }) {
  const grid = useMemo(() => {
    // Build a map of date -> modulesUsed.length
    const dateMap = new Map<string, number>();
    checkIns.forEach((c) => {
      dateMap.set(c.date, c.modulesUsed.length);
    });

    // Generate 90 days (13 weeks × 7 days, aligned to Monday)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the Monday of the week containing (today - 89 days)
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 89);
    // Adjust to Monday
    const dayOfWeek = startDate.getDay(); // 0=Sun, 1=Mon ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate.setDate(startDate.getDate() + mondayOffset);

    const weeks: { date: string; count: number }[][] = [];
    const cursor = new Date(startDate);

    while (cursor <= today || weeks.length < 13) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = cursor.toISOString().split('T')[0];
        week.push({
          date: dateStr,
          count: dateMap.get(dateStr) ?? 0,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
      if (cursor > today && weeks.length >= 13) break;
    }

    return weeks;
  }, [checkIns]);

  return (
    <Card variant="elevated" padding="lg">
      <h3 className="text-h2 text-text-primary mb-kb-md">打卡热力图（近 90 天）</h3>

      {/* Legend */}
      <div className="flex items-center gap-2 mb-kb-sm text-c1 text-text-tertiary">
        <span>少</span>
        <span className="w-3 h-3 rounded-sm bg-bg-tertiary" />
        <span className="w-3 h-3 rounded-sm bg-brand-200" />
        <span className="w-3 h-3 rounded-sm bg-brand-400" />
        <span className="w-3 h-3 rounded-sm bg-brand-600" />
        <span>多</span>
      </div>

      {/* Grid: weekday labels + week columns */}
      <div className="flex gap-1">
        {/* Weekday labels */}
        <div className="flex flex-col gap-1 mr-1">
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={i} className="w-4 h-4 flex items-center justify-end pr-1">
              {i % 2 === 0 && <span className="text-[10px] text-text-tertiary leading-none">{label}</span>}
            </div>
          ))}
        </div>

        {/* Week columns */}
        <div className="flex gap-1 overflow-x-auto">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`w-4 h-4 rounded-sm ${getHeatColor(day.count)}`}
                  title={`${day.date}: ${day.count} 个模块`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function EfficiencyChart({ data }: { data: EfficiencyData }) {
  return (
    <div className="space-y-kb-lg">
      <StudyTrendChart sessions={data.pomodoroSessions} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-kb-lg">
        <ModuleTimePieChart
          sessions={data.pomodoroSessions}
          reviews={data.flashcardReviews}
          feynmanNotes={data.feynmanNotes}
        />
        <CheckInHeatmap checkIns={data.studyCheckIns} />
      </div>
    </div>
  );
}
