import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db } from '@/lib/storage/database';
import type { PomodoroSession, FlashcardReview, FeynmanNote, StudyCheckIn } from '@/types/models';
import EfficiencyChart, { type EfficiencyData } from '../components/EfficiencyChart';
import { BarChart3 } from 'lucide-react';

const pageVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};
const headerVariants = {
  hidden: { opacity: 0, y: -16, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const } },
};

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-24 gap-kb-md"
    >
      <motion.div
        className="w-16 h-16 rounded-kb-full bg-bg-secondary/80 backdrop-blur-xl flex items-center justify-center border border-border/30"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <BarChart3 className="w-8 h-8 text-text-tertiary" strokeWidth={1.5} />
      </motion.div>
      <p className="text-b1 text-text-secondary text-center">
        暂无足够数据，开始学习后将自动生成分析报告
      </p>
      <p className="text-b2 text-text-tertiary text-center">
        使用番茄钟、闪卡复习或费曼学习后，此处将展示你的学习趋势与效率分析
      </p>
    </motion.div>
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
    <motion.div
      className="px-kb-lg py-kb-lg max-w-5xl mx-auto relative"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── 背景环境光 ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #5B8A72 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.05, 0.08, 0.05] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 -left-16 w-56 h-56 rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #6B9BD2 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.04, 0.06, 0.04] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />
      </div>

      {/* ── Page header ── */}
      <motion.div
        className="flex items-center gap-kb-sm mb-kb-lg relative z-10"
        variants={headerVariants}
      >
        <motion.div
          className="w-10 h-10 rounded-kb-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20"
          whileHover={{ scale: 1.1, rotate: -5 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        >
          <BarChart3 className="w-5 h-5 text-white" strokeWidth={1.5} />
        </motion.div>
        <h1 className="text-d2 text-text-primary font-semibold">效率分析</h1>
      </motion.div>

      <div className="relative z-10">
        {loading ? (
          <motion.div
            className="flex items-center justify-center min-h-[40vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-kb-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
        ) : hasData ? (
          <EfficiencyChart data={data!} />
        ) : (
          <EmptyState />
        )}
      </div>
    </motion.div>
  );
}
