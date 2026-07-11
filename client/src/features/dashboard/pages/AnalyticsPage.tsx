import { useState, useEffect } from 'react';
import { db } from '@/lib/storage/database';
import type { PomodoroSession, FlashcardReview, FeynmanNote, StudyCheckIn } from '@/types/models';
import EfficiencyChart, { type EfficiencyData } from '../components/EfficiencyChart';
import { BarChart3 } from 'lucide-react';

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-kb-md">
      <div className="w-16 h-16 rounded-kb-full bg-bg-secondary flex items-center justify-center">
        <BarChart3 className="w-8 h-8 text-text-tertiary" strokeWidth={1.5} />
      </div>
      <p className="text-b1 text-text-secondary text-center">
        暂无足够数据，开始学习后将自动生成分析报告
      </p>
      <p className="text-b2 text-text-tertiary text-center">
        使用番茄钟、闪卡复习或费曼学习后，此处将展示你的学习趋势与效率分析
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<EfficiencyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [pomodoroSessions, flashcardReviews, feynmanNotes, studyCheckIns] = await Promise.all([
        db.pomodoroSessions.toArray() as Promise<PomodoroSession[]>,
        db.flashcardReviews.toArray() as Promise<FlashcardReview[]>,
        db.feynmanNotes.toArray() as Promise<FeynmanNote[]>,
        db.studyCheckIns.toArray() as Promise<StudyCheckIn[]>,
      ]);
      setData({ pomodoroSessions, flashcardReviews, feynmanNotes, studyCheckIns });
      setLoading(false);
    }
    load();
  }, []);

  const hasData =
    data &&
    (data.pomodoroSessions.length > 0 ||
      data.flashcardReviews.length > 0 ||
      data.feynmanNotes.length > 0 ||
      data.studyCheckIns.length > 0);

  return (
    <div className="px-kb-lg py-kb-lg max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-kb-sm mb-kb-lg">
        <BarChart3 className="w-icon-lg h-icon-lg text-brand-600" strokeWidth={1.5} />
        <h1 className="text-d2 text-text-primary font-semibold">效率分析</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-kb-full animate-spin" />
        </div>
      ) : hasData ? (
        <EfficiencyChart data={data!} />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
