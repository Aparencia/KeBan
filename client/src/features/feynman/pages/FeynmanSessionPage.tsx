import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Skeleton, EmptyState } from '@/components/ui';
import { StepIndicator } from '../components/StepIndicator';
import { useFeynmanStore } from '../store/useFeynmanStore';
import type { FeynmanWeakPoint } from '@/types/models';
import {
  ArrowLeft, ArrowRight, Check, Highlighter, X,
  Star, Trash2, CheckCircle2, Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FeynmanSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const {
    notes, summaries, weakPoints, currentNoteId, isLoading,
    loadNote,
    setExplanation,
    updateNote,
    addWeakPoint,
    removeWeakPoint,
    toggleWeakPointMastered,
    setSimplifiedSummary,
    advanceStep,
    setSelfRating,
    completeNote,
    getCurrentView,
  } = useFeynmanStore();

  // Local state
  const [localExplanation, setLocalExplanation] = useState('');
  const [localSummary, setLocalSummary] = useState('');
  const [weakPanelOpen, setWeakPanelOpen] = useState(false);
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; start: number; end: number } | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const explanationRef = useRef<HTMLDivElement>(null);
  const numericId = sessionId && sessionId !== 'new' ? Number(sessionId) : null;

  // Load note on mount
  useEffect(() => {
    if (numericId) {
      loadNote(numericId);
    }
  }, [numericId, loadNote]);

  // Derive current view from store
  const view = numericId && currentNoteId === numericId ? getCurrentView() : null;
  const note = view?.note ?? null;
  const summary = view?.summary ?? null;
  const noteWeakPoints = view?.weakPoints ?? [];

  // Sync local state when note/summary loads
  useEffect(() => {
    if (note) {
      setLocalExplanation(note.explanation);
      setRating(note.selfRating ?? 0);
    }
  }, [note?.id, note?.explanation, note?.selfRating]);

  useEffect(() => {
    if (summary) {
      setLocalSummary(summary.summary);
    } else {
      setLocalSummary('');
    }
  }, [summary?.id, summary?.summary]);

  const currentStep = note?.currentStep ?? 1;
  const completedSteps = Array.from({ length: currentStep - 1 }, (_, i) => i + 1);

  // ── Handlers ──

  const handleStep2Blur = useCallback(async () => {
    if (!numericId || !note) return;
    if (localExplanation !== note.explanation) {
      await updateNote(numericId, { explanation: localExplanation });
    }
  }, [numericId, note, localExplanation, updateNote]);

  const handleSummaryBlur = useCallback(async () => {
    if (!numericId) return;
    const currentSummary = summary?.summary ?? '';
    if (localSummary !== currentSummary) {
      await setSimplifiedSummary(numericId, localSummary);
    }
  }, [numericId, summary, localSummary, setSimplifiedSummary]);

  const handleNext = useCallback(async () => {
    if (!numericId) return;
    // Save current content before advancing
    if (currentStep === 1 && localExplanation.trim()) {
      await setExplanation(numericId, localExplanation);
    } else if (currentStep === 2) {
      if (localExplanation !== note?.explanation) {
        await updateNote(numericId, { explanation: localExplanation });
      }
    } else if (currentStep === 4 && localSummary.trim()) {
      await setSimplifiedSummary(numericId, localSummary);
    }
    await advanceStep(numericId);
  }, [numericId, currentStep, localExplanation, localSummary, note, setExplanation, updateNote, setSimplifiedSummary, advanceStep]);

  const handlePrev = useCallback(() => {
    if (!numericId || !note || currentStep <= 1) return;
    updateNote(numericId, { currentStep: (currentStep - 1) as 1 | 2 | 3 | 4 });
  }, [numericId, note, currentStep, updateNote]);

  const handleComplete = useCallback(async () => {
    if (!numericId) return;
    const currentSummary = summary?.summary ?? '';
    if (localSummary.trim() && localSummary !== currentSummary) {
      await setSimplifiedSummary(numericId, localSummary);
    }
    await completeNote(numericId);
  }, [numericId, localSummary, summary, setSimplifiedSummary, completeNote]);

  const handleRating = useCallback(async (r: number) => {
    if (!numericId) return;
    setRating(r);
    await setSelfRating(numericId, r);
  }, [numericId, setSelfRating]);

  // ── Step 3: Text selection for weak points ──

  const handleTextSelect = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !explanationRef.current) {
      setSelectionPopup(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text) { setSelectionPopup(null); return; }

    const fullText = note?.explanation ?? '';
    const startIdx = fullText.indexOf(text);

    if (startIdx >= 0) {
      setSelectionPopup({
        text,
        start: startIdx,
        end: startIdx + text.length,
      });
    }
  }, [note]);

  const handleAddWeakPoint = useCallback(async () => {
    if (!numericId || !selectionPopup) return;
    await addWeakPoint(numericId, {
      text: selectionPopup.text,
      position: { start: selectionPopup.start, end: selectionPopup.end },
      mastered: false,
    });
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
  }, [numericId, selectionPopup, addWeakPoint]);

  // ── Loading / Empty states ──

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex items-center gap-kb-sm px-kb-md py-3 border-b border-border/50">
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="text" width={200} />
        </div>
        <div className="px-kb-md py-kb-md">
          <Skeleton variant="rectangular" height={60} />
        </div>
        <div className="flex-1 px-kb-md">
          <Skeleton variant="text" lines={6} />
        </div>
      </div>
    );
  }

  if (!note && numericId) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] items-center justify-center">
        <EmptyState
          title="会话未找到"
          description="该学习会话可能已被删除"
          action={
            <Button size="sm" onClick={() => navigate('/feynman')}>
              返回列表
            </Button>
          }
        />
      </div>
    );
  }

  const isCompleted = note?.status === 'completed';

  // ── Render highlighted explanation text with weak points ──
  const renderExplanationWithHighlights = () => {
    const text = note?.explanation ?? '';
    if (!text) return <span className="text-text-tertiary italic">（请先在步骤 2 中写下你的讲解内容）</span>;

    if (noteWeakPoints.length === 0) return <>{text}</>;

    // Build segments
    const sortedWp = [...noteWeakPoints].sort((a, b) => a.position.start - b.position.start);
    const segments: { text: string; wp?: FeynmanWeakPoint }[] = [];
    let cursor = 0;

    for (const wp of sortedWp) {
      if (wp.position.start > cursor) {
        segments.push({ text: text.slice(cursor, wp.position.start) });
      }
      const end = Math.min(wp.position.end, text.length);
      segments.push({ text: text.slice(wp.position.start, end), wp });
      cursor = end;
    }
    if (cursor < text.length) {
      segments.push({ text: text.slice(cursor) });
    }

    return (
      <>
        {segments.map((seg, i) =>
          seg.wp ? (
            <mark
              key={i}
              className={cn(
                'rounded-kb-sm px-0.5 cursor-pointer',
                seg.wp.mastered
                  ? 'bg-semantic-success/20 text-semantic-success'
                  : 'bg-[#F59E0B]/20 text-[#B45309] dark:text-[#F59E0B]',
              )}
              title={seg.wp.mastered ? '已掌握' : '薄弱点'}
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* 顶栏 */}
      <div className="flex items-center gap-kb-sm px-kb-md py-3 border-b border-border/50 flex-shrink-0">
        <button
          onClick={() => navigate('/feynman')}
          className="p-1.5 rounded-kb-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-kb-fast"
        >
          <ArrowLeft className="w-icon-md h-icon-md" strokeWidth={1.5} />
        </button>
        <h1 className="text-b1 font-semibold text-text-primary flex-1 truncate">
          {note?.concept || '费曼学习'}
        </h1>
        {isCompleted && (
          <span className="text-c1 font-medium text-semantic-success flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
            已完成
          </span>
        )}
      </div>

      {/* StepIndicator */}
      <div className="px-kb-md py-kb-md flex-shrink-0">
        <StepIndicator currentStep={currentStep} completedSteps={completedSteps} />
      </div>

      {/* 主体区域 */}
      <div className="flex-1 overflow-hidden flex relative">
        {/* 主内容 */}
        <div className="flex-1 overflow-y-auto px-kb-md pb-kb-md">
          <div key={currentStep} className="animate-fade-in max-w-2xl mx-auto">

            {/* 步骤 1: 选择概念 */}
            {currentStep === 1 && (
              <div className="flex flex-col gap-kb-md py-kb-md">
                <div>
                  <h2 className="text-h2 font-semibold text-text-primary">选择要学习的概念</h2>
                  <p className="text-b2 text-text-tertiary mt-1">
                    输入一个你想要深入理解的概念名称，这将成为本次费曼学习的主题。
                  </p>
                </div>
                <div>
                  <label className="text-b2 font-medium text-text-primary mb-kb-xs block">概念名称</label>
                  <div className={cn(
                    'px-3 py-2.5 rounded-kb-md',
                    'bg-bg-secondary border border-border/70',
                    'text-b1 text-text-primary',
                  )}>
                    {note?.concept || '—'}
                  </div>
                </div>
                <div>
                  <label className="text-b2 font-medium text-text-primary mb-kb-xs block">初始讲解</label>
                  <div className={cn(
                    'relative min-h-[200px] flex flex-col',
                    'border border-border/50 rounded-kb-lg overflow-hidden',
                    'bg-bg-elevated',
                  )}>
                    <textarea
                      value={localExplanation}
                      onChange={(e) => setLocalExplanation(e.target.value)}
                      placeholder="在这里写下你对这个概念的初步理解..."
                      className={cn(
                        'flex-1 p-kb-md bg-transparent outline-none resize-none',
                        'text-b1 text-text-primary placeholder:text-text-tertiary/60',
                        'min-h-[180px]',
                      )}
                    />
                  </div>
                </div>
                <div className={cn(
                  'p-kb-md rounded-kb-lg',
                  'bg-feynman/5 border border-feynman/20',
                  'text-b2 text-text-secondary leading-relaxed',
                )}>
                  <p className="font-medium text-feynman mb-1">费曼学习法小贴士</p>
                  <p className="text-text-tertiary">
                    选择一个你正在学习但尚未完全掌握的概念。用简单的语言向"一个完全不懂的人"解释它，
                    是检验真正理解的最佳方式。
                  </p>
                </div>
              </div>
            )}

            {/* 步骤 2: 讲解概念 */}
            {currentStep === 2 && (
              <div className="flex flex-col gap-kb-md py-kb-md">
                <div>
                  <h2 className="text-h2 font-semibold text-text-primary">讲解「{note?.concept || '...'}」</h2>
                  <p className="text-b2 text-text-tertiary mt-1">
                    用最简洁的语言，像教给一个完全不懂的人那样，解释这个概念的核心内容。
                  </p>
                </div>
                <div className={cn(
                  'relative min-h-[300px] flex flex-col',
                  'border border-border/50 rounded-kb-lg overflow-hidden',
                  'bg-bg-elevated',
                )}>
                  <textarea
                    value={localExplanation}
                    onChange={(e) => setLocalExplanation(e.target.value)}
                    onBlur={handleStep2Blur}
                    placeholder="在这里写下你的讲解... 尽量用通俗易懂的语言，避免直接引用教科书定义。"
                    className={cn(
                      'flex-1 p-kb-md bg-transparent outline-none resize-none',
                      'text-b1 text-text-primary placeholder:text-text-tertiary/60',
                      'min-h-[280px]',
                    )}
                  />
                  <div className={cn(
                    'px-kb-md py-2 border-t border-border/40',
                    'flex items-center justify-between text-c1 text-text-tertiary',
                  )}>
                    <span>失焦自动保存</span>
                    <span>{localExplanation.length} 字</span>
                  </div>
                </div>
              </div>
            )}

            {/* 步骤 3: 标注薄弱 */}
            {currentStep === 3 && (
              <div className="flex flex-col gap-kb-md py-kb-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-h2 font-semibold text-text-primary">标注薄弱环节</h2>
                    <p className="text-b2 text-text-tertiary mt-1">
                      回顾你的讲解，选中说不清楚的文本来标记为薄弱点。
                    </p>
                  </div>
                  <button
                    onClick={() => setWeakPanelOpen(!weakPanelOpen)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-kb-md text-b2',
                      'border transition-all duration-kb-fast',
                      weakPanelOpen
                        ? 'border-[#F59E0B]/40 bg-[#F59E0B]/5 text-[#F59E0B]'
                        : 'border-border/50 text-text-secondary hover:bg-bg-tertiary',
                    )}
                  >
                    <Highlighter className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
                    薄弱点 ({noteWeakPoints.length})
                  </button>
                </div>

                {/* 讲解文本展示（可选中） */}
                <div
                  ref={explanationRef}
                  onMouseUp={handleTextSelect}
                  onKeyUp={handleTextSelect}
                  className={cn(
                    'min-h-[200px] p-kb-md select-text',
                    'border border-border/50 rounded-kb-lg',
                    'bg-bg-elevated',
                    'text-b2 text-text-secondary leading-relaxed',
                    'whitespace-pre-wrap',
                  )}
                >
                  {renderExplanationWithHighlights()}
                </div>

                {/* 选中文本弹窗 */}
                {selectionPopup && (
                  <div className={cn(
                    'flex items-center gap-2 p-2 rounded-kb-md',
                    'bg-[#F59E0B]/10 border border-[#F59E0B]/30',
                  )}>
                    <span className="text-b2 text-text-secondary flex-1 truncate">
                      选中: "{selectionPopup.text.slice(0, 40)}{selectionPopup.text.length > 40 ? '...' : ''}"
                    </span>
                    <Button size="sm" onClick={handleAddWeakPoint}>
                      <Highlighter className="w-icon-sm h-icon-sm mr-1" strokeWidth={1.5} />
                      标记为薄弱点
                    </Button>
                    <button
                      onClick={() => setSelectionPopup(null)}
                      className="p-1 text-text-tertiary hover:text-text-primary"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 步骤 4: 简化重述 */}
            {currentStep === 4 && (
              <div className="flex flex-col gap-kb-md py-kb-md">
                <div>
                  <h2 className="text-h2 font-semibold text-text-primary">简化重述</h2>
                  <p className="text-b2 text-text-tertiary mt-1">
                    用更简洁、更通俗的语言，重新讲解这个概念——这次要确保任何人都能听懂。
                  </p>
                </div>
                <div className={cn(
                  'relative min-h-[200px] flex flex-col',
                  'border border-border/50 rounded-kb-lg overflow-hidden',
                  'bg-bg-elevated',
                )}>
                  <textarea
                    value={localSummary}
                    onChange={(e) => setLocalSummary(e.target.value)}
                    onBlur={handleSummaryBlur}
                    placeholder="用最简单的话重新解释这个概念，就像在和一个朋友聊天..."
                    className={cn(
                      'flex-1 p-kb-md bg-transparent outline-none resize-none',
                      'text-b1 text-text-primary placeholder:text-text-tertiary/60',
                      'min-h-[180px]',
                    )}
                  />
                  <div className={cn(
                    'px-kb-md py-2 border-t border-border/40',
                    'flex items-center justify-between text-c1 text-text-tertiary',
                  )}>
                    <span>失焦自动保存</span>
                    <span>{localSummary.length} 字</span>
                  </div>
                </div>

                {/* 完成后的自评 */}
                {isCompleted && (
                  <div className={cn(
                    'p-kb-md rounded-kb-lg',
                    'bg-bg-secondary border border-border/40',
                    'flex flex-col items-center gap-2',
                  )}>
                    <p className="text-b2 font-medium text-text-primary">理解深度自评</p>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-0.5 transition-all duration-kb-fast"
                        >
                          <Star
                            className={cn(
                              'w-6 h-6 transition-all duration-kb-fast',
                              (hoverRating || rating) >= star
                                ? 'text-[#F59E0B] fill-[#F59E0B]'
                                : 'text-text-tertiary/40',
                            )}
                            strokeWidth={1.5}
                          />
                        </button>
                      ))}
                    </div>
                    {rating > 0 && (
                      <p className="text-c1 text-text-tertiary">
                        {rating <= 2 ? '还需继续学习' : rating <= 4 ? '掌握得不错' : '完全理解了！'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 右侧薄弱点面板（步骤 3 抽屉） */}
        {currentStep === 3 && weakPanelOpen && (
          <aside className={cn(
            'w-72 flex-shrink-0 border-l border-border/50 bg-bg-secondary',
            'overflow-y-auto hidden md:block',
            'animate-slide-in-right',
          )}>
            <div className="p-kb-md">
              <div className="flex items-center justify-between mb-kb-md">
                <h3 className="text-b1 font-semibold text-text-primary">薄弱点列表</h3>
                <button
                  onClick={() => setWeakPanelOpen(false)}
                  className="p-1 rounded-kb-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-kb-fast"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
              {noteWeakPoints.length === 0 ? (
                <p className="text-b2 text-text-tertiary text-center py-4">
                  选中讲解文本即可标记薄弱点
                </p>
              ) : (
                <div className="space-y-2.5">
                  {noteWeakPoints.map((wp) => (
                    <div
                      key={wp.id}
                      className={cn(
                        'flex gap-2.5 p-3 rounded-kb-md',
                        'bg-bg-elevated border border-border/40',
                        'group',
                      )}
                    >
                      <button
                        onClick={() => numericId && wp.id && toggleWeakPointMastered(numericId, wp.id)}
                        className="flex-shrink-0 mt-0.5"
                        title={wp.mastered ? '标记为未掌握' : '标记为已掌握'}
                      >
                        {wp.mastered ? (
                          <CheckCircle2 className="w-5 h-5 text-semantic-success" strokeWidth={1.5} />
                        ) : (
                          <Circle className="w-5 h-5 text-text-tertiary" strokeWidth={1.5} />
                        )}
                      </button>
                      <p className={cn(
                        'text-b3 leading-relaxed flex-1',
                        wp.mastered ? 'text-text-tertiary line-through' : 'text-text-secondary',
                      )}>
                        {wp.text}
                      </p>
                      <button
                        onClick={() => numericId && wp.id && removeWeakPoint(numericId, wp.id)}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-text-tertiary hover:text-semantic-error transition-all duration-kb-fast"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 底部导航 */}
      <div className={cn(
        'flex items-center justify-between gap-kb-sm px-kb-md py-3',
        'border-t border-border/50 bg-bg-elevated flex-shrink-0',
      )}>
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowLeft className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
          onClick={handlePrev}
          disabled={currentStep === 1}
        >
          上一步
        </Button>

        {currentStep < 4 ? (
          <Button
            size="sm"
            icon={<ArrowRight className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
            iconRight={<span />}
            onClick={handleNext}
          >
            下一步
          </Button>
        ) : !isCompleted ? (
          <Button
            size="sm"
            icon={<Check className="w-icon-sm h-icon-sm" strokeWidth={2} />}
            onClick={handleComplete}
          >
            完成学习
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/feynman')}
          >
            返回列表
          </Button>
        )}
      </div>

      {/* 动画样式 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 250ms var(--kb-ease-out) forwards;
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 200ms var(--kb-ease-out) forwards;
        }
      `}</style>
    </div>
  );
}
