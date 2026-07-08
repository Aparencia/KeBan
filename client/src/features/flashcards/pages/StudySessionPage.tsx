import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, EmptyState } from '@/components/ui';
import { FlipCard } from '../components/FlipCard';
import { X, RotateCcw, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudySessionStore } from '../store/useStudySessionStore';
import { useFlashcardStore } from '../store/useFlashcardStore';
import { Rating, calculateIntervals } from '@/lib/sm2';

function formatInterval(days: number): string {
  if (days === 0) return '<1d';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

const ratingStyles = [
  { label: 'Again', rating: Rating.Again, color: 'bg-[#F43F5E] hover:bg-rose-700' },
  { label: 'Hard', rating: Rating.Hard, color: 'bg-[#F59E0B] hover:bg-amber-600' },
  { label: 'Good', rating: Rating.Good, color: 'bg-[#10B981] hover:bg-emerald-600' },
  { label: 'Easy', rating: Rating.Easy, color: 'bg-brand-600 hover:bg-brand-700' },
];

export default function StudySessionPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const numericDeckId = Number(deckId);

  const {
    sessionCards,
    currentIndex,
    isFlipped,
    completedCount,
    isActive,
    startSession,
    rateCard,
    flipCard,
    endSession,
  } = useStudySessionStore();

  const { selectDeck, loadCards } = useFlashcardStore();

  // Initialize session on mount
  useEffect(() => {
    if (!isNaN(numericDeckId)) {
      selectDeck(numericDeckId);
      loadCards(numericDeckId).then(() => {
        startSession(numericDeckId);
      });
    }
    return () => {
      // Cleanup: end session on unmount
    };
  }, [numericDeckId, selectDeck, loadCards, startSession]);

  const total = sessionCards.length;
  const current = sessionCards[currentIndex];
  const isComplete = !isActive && completedCount > 0;

  // Calculate dynamic intervals for current card
  const intervals = current
    ? calculateIntervals({
        easeFactor: current.easeFactor,
        interval: current.interval,
        repetitions: current.repetitions,
      })
    : null;

  const intervalValues = intervals
    ? [intervals.again, intervals.hard, intervals.good, intervals.easy]
    : [1, 1, 1, 1];

  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const handleRate = (rating: Rating) => {
    rateCard(rating);
  };

  const handleRestart = () => {
    endSession();
    if (!isNaN(numericDeckId)) {
      startSession(numericDeckId);
    }
  };

  const handleFinish = () => {
    endSession();
    navigate(`/flashcards/${deckId}`);
  };

  // No cards available
  if (total === 0 && !isActive) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-bg-secondary">
        <div className="flex items-center gap-kb-sm px-kb-md py-3 flex-shrink-0">
          <button
            onClick={() => navigate(`/flashcards/${deckId}`)}
            className="p-1.5 rounded-kb-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-kb-fast"
          >
            <X className="w-icon-md h-icon-md" strokeWidth={1.5} />
          </button>
          <h1 className="text-h2 font-semibold text-text-primary flex-1">学习</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<BookOpen className="w-12 h-12" strokeWidth={1.2} />}
            title="暂无可学习卡片"
            description="当前牌组没有到期卡片或新卡片，请先添加一些卡片"
            action={
              <Button variant="secondary" onClick={() => navigate(`/flashcards/${deckId}`)}>
                返回牌组
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-bg-secondary">
      {/* 顶栏 */}
      <div className="flex items-center gap-kb-sm px-kb-md py-3 flex-shrink-0">
        <button
          onClick={() => navigate(`/flashcards/${deckId}`)}
          className="p-1.5 rounded-kb-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-kb-fast"
        >
          <X className="w-icon-md h-icon-md" strokeWidth={1.5} />
        </button>
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-b3 font-medium text-text-secondary">
              {completedCount}/{total} 已学习
            </span>
            <span className="text-c1 text-text-tertiary">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-kb-full bg-bg-tertiary overflow-hidden flex-1 min-h-0">
            <div
              className="h-full rounded-kb-full bg-flashcard transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* 卡片主体 */}
      <div className="flex-1 flex items-center justify-center px-kb-md overflow-hidden">
        {!isComplete && current ? (
          <div className="w-full max-w-xl">
            <FlipCard
              front={current.front}
              back={current.back}
              isFlipped={isFlipped}
              onFlip={flipCard}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-kb-md text-center py-kb-2xl">
            <div className={cn(
              'w-16 h-16 rounded-kb-xl',
              'bg-semantic-success/10 flex items-center justify-center',
              'text-semantic-success',
            )}>
              <RotateCcw className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <h2 className="text-h1 font-semibold text-text-primary">本轮学习完成！</h2>
            <p className="text-b2 text-text-tertiary">共复习了 {completedCount} 张卡片</p>
            <div className="flex gap-3 mt-kb-sm">
              <Button variant="secondary" onClick={handleRestart}>
                再来一轮
              </Button>
              <Button onClick={handleFinish}>
                返回牌组
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 底部评分区 */}
      {!isComplete && current && (
        <div className={cn(
          'flex-shrink-0 px-kb-md py-4 border-t border-border/50',
          'bg-bg-elevated',
        )}>
          {!isFlipped ? (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                size="lg"
                icon={<RotateCcw className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
                onClick={flipCard}
                className="min-w-[160px]"
              >
                翻转查看
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {ratingStyles.map(({ label, rating, color }, i) => (
                <button
                  key={label}
                  onClick={() => handleRate(rating)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-3 rounded-kb-lg',
                    'text-white font-semibold text-b2',
                    'transition-all duration-kb-fast',
                    'hover:scale-[1.03] active:scale-[0.97]',
                    'shadow-kb-sm',
                    color,
                  )}
                >
                  <span className="text-c1 opacity-75">{formatInterval(intervalValues[i])}</span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
