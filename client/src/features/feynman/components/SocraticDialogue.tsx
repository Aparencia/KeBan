/**
 * 苏格拉底追问对话 UI — Phase 2
 * 多轮对话 + 四维度评分雷达图
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { AIThinkingIndicator } from '@/components/ui/AIThinkingIndicator';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import type { SocraticRound, DimensionScore } from '../types';

interface SocraticDialogueProps {
  rounds: SocraticRound[];
  currentRound: number;
  maxRounds: number;
  onSubmitAnswer: (answer: string) => void;
  loading: boolean;
  /** 当所有轮次完成时为 true */
  completed?: boolean;
}

const DIMENSION_LABELS: Record<keyof DimensionScore, string> = {
  accuracy: '准确度',
  completeness: '完整度',
  logic: '逻辑清晰',
  expression: '表达通俗',
};

function DimensionRadar({ dimensions }: { dimensions: DimensionScore }) {
  const data = (Object.keys(DIMENSION_LABELS) as (keyof DimensionScore)[]).map(key => ({
    dimension: DIMENSION_LABELS[key],
    score: dimensions[key],
    fullMark: 10,
  }));

  return (
    <div className="w-36 h-36 mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="var(--kb-border-default)" strokeOpacity={0.4} />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fontSize: 11, fill: 'var(--kb-text-tertiary)' }}
          />
          <Radar
            dataKey="score"
            stroke="var(--kb-brand-500)"
            fill="var(--kb-brand-500)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RoundBubble({ round, isLatest }: { round: SocraticRound; isLatest: boolean }) {
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <motion.div
      className="flex flex-col gap-kb-sm"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* AI 问题气泡（左侧）— text-b2 = 14px */}
      <div className="flex items-start gap-2 max-w-[85%]">
        <div className="w-7 h-7 rounded-kb-full bg-brand-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-brand-500" strokeWidth={1.5} />
        </div>
        <div className={cn(
          'px-3.5 py-2.5 rounded-kb-lg rounded-tl-sm',
          'bg-bg-secondary text-b2 text-text-primary leading-relaxed',
        )}>
          {round.aiQuestion}
        </div>
      </div>

      {/* 用户回答气泡（右侧）— 15px + 左侧品牌色描边 */}
      {round.userAnswer && (
        <div className="flex items-start gap-2 max-w-[85%] self-end flex-row-reverse">
          <div
            className={cn(
              'px-3.5 py-2.5 rounded-kb-lg rounded-tr-sm',
              'bg-brand-50 text-text-primary leading-relaxed',
              'border-l-2 border-brand-400/40',
            )}
            style={{ fontSize: '15px' }}
          >
            {round.userAnswer}
          </div>
        </div>
      )}

      {/* AI 反馈 — 摘要始终可见，详细评分折叠 */}
      {round.aiFeedback && (
        <div className="ml-9">
          {/* 始终可见的反馈摘要 */}
          <p className="text-b2 text-text-secondary leading-relaxed mb-2">
            {round.aiFeedback}
          </p>

          {/* 有维度评分时显示折叠入口 */}
          {round.dimensions && (
            <>
              <button
                onClick={() => setDetailOpen(!detailOpen)}
                className="flex items-center gap-1 text-c1 text-brand-500 hover:text-brand-600 transition-colors mb-1"
              >
                {detailOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {detailOpen ? '收起详细评分' : '查看详细评分'}
              </button>

              <AnimatePresence>
                {detailOpen && (
                  <motion.div
                    className={cn(
                      'p-kb-md rounded-kb-lg',
                      'bg-bg-elevated border border-border/30',
                    )}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    {/* 四维度评分 */}
                    <div className="flex items-center gap-4">
                      <DimensionRadar dimensions={round.dimensions} />
                      <div className="flex flex-col gap-1.5">
                        {(Object.keys(DIMENSION_LABELS) as (keyof DimensionScore)[]).map(key => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-c1 text-text-tertiary w-14">{DIMENSION_LABELS[key]}</span>
                            <div className="w-20 h-1.5 bg-bg-tertiary rounded-kb-full overflow-hidden">
                              <motion.div
                                className="h-full bg-brand-500 rounded-kb-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${(round.dimensions![key] / 10) * 100}%` }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                              />
                            </div>
                            <span className="text-c1 text-text-secondary w-5 text-right font-medium">
                              {round.dimensions![key]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 提示 */}
                    {round.hints.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/20">
                        <p className="text-c1 text-text-tertiary mb-1">思考提示：</p>
                        {round.hints.map((h, i) => (
                          <p key={i} className="text-c1 text-text-secondary">💡 {h}</p>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* 无维度评分时，hints 直接展示 */}
          {!round.dimensions && round.hints.length > 0 && (
            <div className="mt-1">
              {round.hints.map((h, i) => (
                <p key={i} className="text-c1 text-text-tertiary">💡 {h}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function SkeletonPulse() {
  return (
    <div className="flex items-start gap-2 max-w-[85%]">
      <div className="w-7 h-7 rounded-kb-full bg-bg-tertiary animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-bg-tertiary rounded-kb-sm animate-pulse w-3/4" />
        <div className="h-4 bg-bg-tertiary rounded-kb-sm animate-pulse w-1/2" />
      </div>
    </div>
  );
}

export default function SocraticDialogue({
  rounds, currentRound, maxRounds, onSubmitAnswer, loading, completed,
}: SocraticDialogueProps) {
  const [answer, setAnswer] = useState('');

  const handleSubmit = () => {
    if (!answer.trim() || loading) return;
    onSubmitAnswer(answer.trim());
    setAnswer('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-kb-md">
      {/* 轮次指示器 */}
      <div className="flex items-center gap-2 text-b2 text-text-tertiary">
        <span className="px-2.5 py-0.5 rounded-kb-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-c1 font-semibold">
          第 {currentRound}/{maxRounds} 轮
        </span>
        {completed && (
          <span className="px-2.5 py-0.5 rounded-kb-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-c1 font-semibold">
            ✓ 追问完成
          </span>
        )}
      </div>

      {/* 对话流 */}
      <div className="flex flex-col gap-kb-lg">
        {rounds.map((round, i) => (
          <RoundBubble key={round.roundNumber} round={round} isLatest={i === rounds.length - 1} />
        ))}

        {/* 加载骨架 */}
        {loading && <SkeletonPulse />}
      </div>

      {/* 输入区（追问未完成时显示） */}
      {!completed && (
        <div className={cn(
          'flex items-end gap-2 p-2 rounded-kb-lg',
          'border border-border/50 bg-bg-elevated',
          'focus-within:border-brand-500/50 focus-within:shadow-[var(--kb-shadow-brand)] transition-all duration-kb-fast',
        )}>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="写下你的思考..."
            rows={2}
            className={cn(
              'flex-1 px-3 py-2 bg-transparent outline-none resize-none',
              'text-b2 text-text-primary placeholder:text-text-tertiary/60',
            )}
          />
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || loading}
            className={cn(
              'p-2.5 rounded-kb-md transition-all duration-kb-fast',
              answer.trim() && !loading
                ? 'bg-brand-500 text-white hover:bg-brand-600 active:scale-95'
                : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed',
            )}
          >
            {loading ? <AIThinkingIndicator size={4} gap={3} /> : <Send className="w-4 h-4" strokeWidth={1.5} />}
          </button>
        </div>
      )}
    </div>
  );
}
