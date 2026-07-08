import { create } from 'zustand';
import {
  flashcardDeckStore,
  flashcardStore,
  flashcardReviewStore,
} from '@/lib/storage';
import { createNewCardState } from '@/lib/sm2';
import type { Flashcard, FlashcardDeck } from '@/types/models';
import { useStudySessionStore } from './useStudySessionStore';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface DeckStats {
  total: number;
  due: number;
  newCards: number;
}

interface FlashcardState {
  // 数据
  decks: FlashcardDeck[];
  cards: Flashcard[];
  isLoading: boolean;
  selectedDeckId: number | null;

  // 牌组操作
  loadDecks: () => Promise<void>;
  createDeck: (name: string, description?: string, color?: string) => Promise<number>;
  updateDeck: (id: number, changes: Partial<FlashcardDeck>) => Promise<void>;
  deleteDeck: (id: number) => Promise<void>;
  selectDeck: (id: number | null) => void;

  // 卡片操作
  loadCards: (deckId: number) => Promise<void>;
  createCard: (
    card: Omit<
      Flashcard,
      'id' | 'easeFactor' | 'interval' | 'repetitions' | 'dueDate' | 'createdAt' | 'updatedAt' | 'order'
    >,
  ) => Promise<number>;
  updateCard: (id: number, changes: Partial<Flashcard>) => Promise<void>;
  deleteCard: (id: number) => Promise<void>;

  // 统计
  getDeckStats: (deckId: number) => DeckStats;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFlashcardStore = create<FlashcardState>((set, get) => {
  return {
    decks: [],
    cards: [],
    isLoading: false,
    selectedDeckId: null,

    // -----------------------------------------------------------------------
    // 牌组操作
    // -----------------------------------------------------------------------

    loadDecks: async () => {
      set({ isLoading: true });
      try {
        const decks = await flashcardDeckStore.getAll();
        set({ decks, isLoading: false });
      } catch {
        set({ isLoading: false });
        throw new Error('加载牌组失败');
      }
    },

    createDeck: async (name, description, color) => {
      const now = new Date();
      const deck: FlashcardDeck = {
        name,
        description,
        color,
        createdAt: now,
        updatedAt: now,
        order: Date.now(),
      };
      const id = await flashcardDeckStore.create(deck);
      // 将新牌组追加到本地状态
      set((state) => ({ decks: [...state.decks, { ...deck, id }] }));
      return id as number;
    },

    updateDeck: async (id, changes) => {
      const updatedAt = new Date();
      await flashcardDeckStore.update(id, { ...changes, updatedAt });
      set((state) => ({
        decks: state.decks.map((d) =>
          d.id === id ? { ...d, ...changes, updatedAt } : d,
        ),
      }));
    },

    deleteDeck: async (id) => {
      // 级联删除：先删除该牌组下的所有复习记录，再删除所有卡片，最后删除牌组
      const deckCards = await flashcardStore.where('deckId', id);
      const deckReviews = await flashcardReviewStore.where('deckId', id);

      await Promise.all([
        ...deckReviews.map((r) => flashcardReviewStore.delete(r.id!)),
        ...deckCards.map((c) => flashcardStore.delete(c.id!)),
      ]);
      await flashcardDeckStore.delete(id);

      set((state) => ({
        decks: state.decks.filter((d) => d.id !== id),
        // 若删除的是当前选中牌组，清空选中
        selectedDeckId: state.selectedDeckId === id ? null : state.selectedDeckId,
        // 若当前展示的是被删除牌组的卡片，清空
        cards: state.selectedDeckId === id ? [] : state.cards,
      }));

      // 清理学习会话中该牌组的缓存数据
      useStudySessionStore.getState().clearDeckSession(id);
    },

    selectDeck: (id) => {
      set({ selectedDeckId: id });
    },

    // -----------------------------------------------------------------------
    // 卡片操作
    // -----------------------------------------------------------------------

    loadCards: async (deckId) => {
      set({ isLoading: true });
      try {
        const cards = await flashcardStore.where('deckId', deckId);
        set({ cards, isLoading: false });
      } catch {
        set({ isLoading: false });
        throw new Error('加载卡片失败');
      }
    },

    createCard: async (cardInput) => {
      const now = new Date();
      const sm2Init = createNewCardState();
      const card: Flashcard = {
        ...cardInput,
        easeFactor: sm2Init.easeFactor,
        interval: sm2Init.interval,
        repetitions: sm2Init.repetitions,
        dueDate: sm2Init.dueDate,
        createdAt: now,
        updatedAt: now,
        order: Date.now(),
      };
      const id = await flashcardStore.create(card);
      set((state) => ({ cards: [...state.cards, { ...card, id }] }));
      return id as number;
    },

    updateCard: async (id, changes) => {
      const updatedAt = new Date();
      await flashcardStore.update(id, { ...changes, updatedAt });
      set((state) => ({
        cards: state.cards.map((c) =>
          c.id === id ? { ...c, ...changes, updatedAt } : c,
        ),
      }));
    },

    deleteCard: async (id) => {
      await flashcardStore.delete(id);
      set((state) => ({
        cards: state.cards.filter((c) => c.id !== id),
      }));
    },

    // -----------------------------------------------------------------------
    // 统计
    // -----------------------------------------------------------------------

    getDeckStats: (deckId) => {
      const { cards } = get();
      const deckCards = cards.filter((c) => c.deckId === deckId);
      const now = new Date();

      return {
        total: deckCards.length,
        due: deckCards.filter((c) => new Date(c.dueDate) <= now).length,
        newCards: deckCards.filter((c) => c.repetitions === 0).length,
      };
    },
  };
});
