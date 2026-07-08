import { create } from 'zustand';
import {
  flashcardStore,
  flashcardReviewStore,
} from '@/lib/storage';
import { sm2, Rating } from '@/lib/sm2';
import type { Flashcard, FlashcardReview } from '@/types/models';
import { useFlashcardStore } from './useFlashcardStore';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 到期卡片不足此数量时，补充新卡 */
const MIN_DUE_THRESHOLD = 10;
/** 单次会话最多卡片数 */
const MAX_SESSION_CARDS = 20;

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

interface StudySessionState {
  // 会话数据
  sessionCards: Flashcard[];
  currentIndex: number;
  isFlipped: boolean;
  completedCount: number;
  sessionStartTime: Date | null;
  isActive: boolean;
  /** 当前卡片开始展示的时间戳（用于计算 timeSpent） */
  cardStartTime: Date | null;

  // 会话操作
  startSession: (deckId: number) => Promise<void>;
  rateCard: (rating: Rating) => Promise<void>;
  flipCard: () => void;
  endSession: () => void;
  /** 清理指定牌组的会话数据（牌组删除时调用） */
  clearDeckSession: (deckId: number) => void;
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/** 洗牌（Fisher-Yates） */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useStudySessionStore = create<StudySessionState>((set, get) => {
  return {
    sessionCards: [],
    currentIndex: 0,
    isFlipped: false,
    completedCount: 0,
    sessionStartTime: null,
    isActive: false,
    cardStartTime: null,

    // -----------------------------------------------------------------------
    // startSession：加载到期卡片 + 补充新卡
    // -----------------------------------------------------------------------
    startSession: async (deckId) => {
      // 确保牌组卡片已加载到 flashcard store
      const { cards, loadCards } = useFlashcardStore.getState();
      if (cards.length === 0 || useFlashcardStore.getState().selectedDeckId !== deckId) {
        await loadCards(deckId);
      }

      const allCards = useFlashcardStore.getState().cards.filter(
        (c) => c.deckId === deckId,
      );
      const now = new Date();

      // 到期卡片：dueDate <= now 且 repetitions > 0（非全新卡）
      const dueCards = shuffle(
        allCards.filter(
          (c) => new Date(c.dueDate) <= now && c.repetitions > 0,
        ),
      );

      // 新卡片：从未复习过
      const newCards = shuffle(
        allCards.filter((c) => c.repetitions === 0),
      );

      // 组装会话卡片列表
      let sessionCards: Flashcard[];
      if (dueCards.length >= MIN_DUE_THRESHOLD) {
        // 到期卡充足：只用到期卡（上限 MAX_SESSION_CARDS）
        sessionCards = dueCards.slice(0, MAX_SESSION_CARDS);
      } else {
        // 到期卡不足：补充新卡，总量不超过 MAX_SESSION_CARDS
        const needNew = Math.min(
          MAX_SESSION_CARDS - dueCards.length,
          newCards.length,
        );
        sessionCards = [...dueCards, ...newCards.slice(0, needNew)];
      }

      if (sessionCards.length === 0) {
        // 无可学习卡片，不启动会话
        return;
      }

      set({
        sessionCards,
        currentIndex: 0,
        isFlipped: false,
        completedCount: 0,
        sessionStartTime: new Date(),
        isActive: true,
        cardStartTime: new Date(),
      });
    },

    // -----------------------------------------------------------------------
    // rateCard：评分并推进到下一张
    // -----------------------------------------------------------------------
    rateCard: async (rating) => {
      const { sessionCards, currentIndex, cardStartTime, isFlipped } = get();

      // 必须已翻面才能评分
      if (!isFlipped) return;

      const card = sessionCards[currentIndex];
      if (!card || card.id === undefined) return;

      // 调用 SM-2 算法（lapses 不在 Flashcard 接口中，传 0 兜底）
      const result = sm2(
        {
          easeFactor: card.easeFactor,
          interval: card.interval,
          repetitions: card.repetitions,
        },
        rating,
      );

      // 更新卡片持久化存储
      const updatedAt = new Date();
      await flashcardStore.update(card.id, {
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
        dueDate: result.dueDate,
        lastReviewDate: updatedAt,
        updatedAt,
      });

      // 同步更新本地 sessionCards 中的对应卡片
      const updatedCards = sessionCards.map((c, i) =>
        i === currentIndex
          ? {
              ...c,
              easeFactor: result.easeFactor,
              interval: result.interval,
              repetitions: result.repetitions,
              dueDate: result.dueDate,
              lastReviewDate: updatedAt,
              updatedAt,
            }
          : c,
      );

      // 创建复习记录（FlashcardReview.rating 为 1-4，需 +1 映射）
      const review: FlashcardReview = {
        cardId: card.id,
        deckId: card.deckId,
        rating: (rating + 1) as FlashcardReview['rating'],
        easeFactorBefore: card.easeFactor,
        easeFactorAfter: result.easeFactor,
        intervalBefore: card.interval,
        intervalAfter: result.interval,
        reviewedAt: updatedAt,
        timeSpent: cardStartTime
          ? Math.round((updatedAt.getTime() - cardStartTime.getTime()) / 1000)
          : 0,
      };
      await flashcardReviewStore.create(review);

      // 同步 flashcard store 中对应的卡片状态
      const flashcardState = useFlashcardStore.getState();
      flashcardState.updateCard(card.id, {
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
        dueDate: result.dueDate,
        lastReviewDate: updatedAt,
      });

      const nextIndex = currentIndex + 1;
      const isLastCard = nextIndex >= sessionCards.length;

      if (isLastCard) {
        // 会话结束
        set({
          sessionCards: updatedCards,
          currentIndex: nextIndex,
          completedCount: get().completedCount + 1,
          isActive: false,
          isFlipped: false,
          cardStartTime: null,
        });
      } else {
        // 推进到下一张卡片
        set({
          sessionCards: updatedCards,
          currentIndex: nextIndex,
          completedCount: get().completedCount + 1,
          isFlipped: false,
          cardStartTime: new Date(),
        });
      }
    },

    // -----------------------------------------------------------------------
    // flipCard：翻转卡片
    // -----------------------------------------------------------------------
    flipCard: () => {
      set((state) => ({ isFlipped: !state.isFlipped }));
    },

    // -----------------------------------------------------------------------
    // endSession：提前结束会话
    // -----------------------------------------------------------------------
    endSession: () => {
      set({
        sessionCards: [],
        currentIndex: 0,
        isFlipped: false,
        completedCount: 0,
        sessionStartTime: null,
        isActive: false,
        cardStartTime: null,
      });
    },

    // -----------------------------------------------------------------------
    // clearDeckSession：牌组删除时清理对应会话数据
    // -----------------------------------------------------------------------
    clearDeckSession: (deckId: number) => {
      const { sessionCards, isActive } = get();
      if (!isActive) return;
      // 如果当前会话中包含该牌组的卡片，结束会话
      if (sessionCards.some((c) => c.deckId === deckId)) {
        get().endSession();
      }
    },
  };
});
