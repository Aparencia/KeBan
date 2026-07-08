import { create } from 'zustand';
import { feynmanNoteStore, feynmanSummaryStore, feynmanWeakPointStore } from '@/lib/storage';
import type { FeynmanNote, FeynmanSummary, FeynmanWeakPoint } from '@/types/models';

// ── Store 内部组合视图（用于 UI 展示）─────────────────────────

export interface FeynmanNoteView {
  note: FeynmanNote;
  summary: FeynmanSummary | null;
  weakPoints: FeynmanWeakPoint[];
}

// ── Store 类型定义 ──────────────────────────────────────────

interface FeynmanState {
  // 数据
  notes: FeynmanNote[];
  summaries: Record<number, FeynmanSummary | null>;        // noteId → summary
  weakPoints: Record<number, FeynmanWeakPoint[]>;          // noteId → weakPoints[]
  currentNoteId: number | null;
  isLoading: boolean;

  // 会话操作
  loadNotes: () => Promise<void>;
  loadNote: (id: number) => Promise<void>;
  createNote: (concept: string) => Promise<number>;
  updateNote: (id: number, changes: Partial<FeynmanNote>) => Promise<void>;
  deleteNote: (id: number) => Promise<void>;

  // 四步流程
  setExplanation: (noteId: number, explanation: string) => Promise<void>;
  addWeakPoint: (noteId: number, weakPoint: Omit<FeynmanWeakPoint, 'id' | 'noteId' | 'createdAt'>) => Promise<number>;
  removeWeakPoint: (noteId: number, weakPointId: number) => Promise<void>;
  toggleWeakPointMastered: (noteId: number, weakPointId: number) => Promise<void>;
  setSimplifiedSummary: (noteId: number, summary: string) => Promise<void>;
  advanceStep: (noteId: number) => Promise<void>;
  setSelfRating: (noteId: number, rating: number) => Promise<void>;
  completeNote: (noteId: number) => Promise<void>;

  // 批量加载
  loadWeakPointsForNotes: (noteIds: number[]) => Promise<void>;

  // 统计
  getStats: () => { total: number; completed: number; weakPointsCount: number };

  // 便捷 getter
  getCurrentView: () => FeynmanNoteView | null;
}

// ── 工具函数 ────────────────────────────────────────────────

/** 在 notes 数组中替换指定 id 的 note */
function patchNote(notes: FeynmanNote[], updated: FeynmanNote): FeynmanNote[] {
  return notes.map((n) => (n.id === updated.id ? updated : n));
}

// ── Store ────────────────────────────────────────────────────

export const useFeynmanStore = create<FeynmanState>((set, get) => {
  return {
    notes: [],
    summaries: {},
    weakPoints: {},
    currentNoteId: null,
    isLoading: false,

    // ── 会话操作 ────────────────────────────────────────────

    loadNotes: async () => {
      set({ isLoading: true });
      try {
        const all = await feynmanNoteStore.getAll();
        all.sort(
          (a: FeynmanNote, b: FeynmanNote) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        set({ notes: all, isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    },

    loadNote: async (id: number) => {
      set({ isLoading: true });
      try {
        const [note, summaries, weakPoints] = await Promise.all([
          feynmanNoteStore.getById(id),
          feynmanSummaryStore.where('noteId', id),
          feynmanWeakPointStore.where('noteId', id),
        ]);

        set((state) => ({
          currentNoteId: note ? id : null,
          summaries: { ...state.summaries, [id]: summaries[0] ?? null },
          weakPoints: { ...state.weakPoints, [id]: weakPoints },
          isLoading: false,
          // 若 notes 中不含此 note，则补充进去
          notes: state.notes.some((n) => n.id === id) && note
            ? patchNote(state.notes, note)
            : note
              ? [...state.notes, note]
              : state.notes,
        }));
      } catch {
        set({ isLoading: false });
      }
    },

    createNote: async (concept: string) => {
      const now = new Date();
      const note: FeynmanNote = {
        concept,
        explanation: '',
        status: 'not_started',
        currentStep: 1,
        createdAt: now,
        updatedAt: now,
      };
      const id = await feynmanNoteStore.create(note);
      const created = { ...note, id } as FeynmanNote;
      set((state) => ({
        notes: [created, ...state.notes],
        summaries: { ...state.summaries, [id]: null },
        weakPoints: { ...state.weakPoints, [id]: [] },
        currentNoteId: id,
      }));
      return id as number;
    },

    updateNote: async (id: number, changes: Partial<FeynmanNote>) => {
      const current = get().notes.find((n) => n.id === id);
      if (!current) return;
      const updated: FeynmanNote = { ...current, ...changes, updatedAt: new Date() };
      await feynmanNoteStore.update(id, updated);
      set((state) => ({ notes: patchNote(state.notes, updated) }));
    },

    deleteNote: async (id: number) => {
      // 删除关联的 summary 和 weakPoints
      const summaries = await feynmanSummaryStore.where('noteId', id);
      const weakPoints = await feynmanWeakPointStore.where('noteId', id);

      await Promise.all([
        feynmanNoteStore.delete(id),
        ...summaries.map((s: FeynmanSummary) => feynmanSummaryStore.delete(s.id!)),
        ...weakPoints.map((w: FeynmanWeakPoint) => feynmanWeakPointStore.delete(w.id!)),
      ]);

      set((state) => {
        const summaries2 = { ...state.summaries };
        const weakPoints2 = { ...state.weakPoints };
        delete summaries2[id];
        delete weakPoints2[id];
        return {
          notes: state.notes.filter((n) => n.id !== id),
          summaries: summaries2,
          weakPoints: weakPoints2,
          currentNoteId: state.currentNoteId === id ? null : state.currentNoteId,
        };
      });
    },

    // ── 四步流程 ────────────────────────────────────────────

    setExplanation: async (noteId: number, explanation: string) => {
      const note = get().notes.find((n) => n.id === noteId);
      if (!note) return;

      const updated: FeynmanNote = { ...note, explanation, updatedAt: new Date() };

      // 如果当前在 step 1，自动推进到 step 2
      if (note.currentStep === 1) {
        updated.currentStep = 2;
        updated.status = 'in_progress';
      }

      await feynmanNoteStore.update(noteId, updated);
      set((state) => ({ notes: patchNote(state.notes, updated) }));
    },

    addWeakPoint: async (noteId: number, weakPoint: Omit<FeynmanWeakPoint, 'id' | 'noteId' | 'createdAt'>) => {
      const record: FeynmanWeakPoint = {
        ...weakPoint,
        noteId,
        mastered: weakPoint.mastered ?? false,
        createdAt: new Date(),
      };
      const id = await feynmanWeakPointStore.create(record);
      const created = { ...record, id } as FeynmanWeakPoint;

      set((state) => ({
        weakPoints: {
          ...state.weakPoints,
          [noteId]: [...(state.weakPoints[noteId] ?? []), created],
        },
      }));
      return id as number;
    },

    removeWeakPoint: async (noteId: number, weakPointId: number) => {
      await feynmanWeakPointStore.delete(weakPointId);
      set((state) => ({
        weakPoints: {
          ...state.weakPoints,
          [noteId]: (state.weakPoints[noteId] ?? []).filter((w) => w.id !== weakPointId),
        },
      }));
    },

    toggleWeakPointMastered: async (noteId: number, weakPointId: number) => {
      const wps = get().weakPoints[noteId] ?? [];
      const wp = wps.find((w) => w.id === weakPointId);
      if (!wp) return;

      const updated = { ...wp, mastered: !wp.mastered };
      await feynmanWeakPointStore.update(weakPointId, updated);

      set((state) => ({
        weakPoints: {
          ...state.weakPoints,
          [noteId]: (state.weakPoints[noteId] ?? []).map((w) =>
            w.id === weakPointId ? updated : w,
          ),
        },
      }));
    },

    setSimplifiedSummary: async (noteId: number, summary: string) => {
      const existing = get().summaries[noteId];

      if (existing) {
        // 更新已有记录
        const updated: FeynmanSummary = { ...existing, summary, updatedAt: new Date() };
        await feynmanSummaryStore.update(existing.id!, updated);
        set((state) => ({
          summaries: { ...state.summaries, [noteId]: updated },
        }));
      } else {
        // 新建记录
        const now = new Date();
        const record: FeynmanSummary = {
          noteId,
          summary,
          createdAt: now,
          updatedAt: now,
        };
        const id = await feynmanSummaryStore.create(record);
        set((state) => ({
          summaries: { ...state.summaries, [noteId]: { ...record, id } as FeynmanSummary },
        }));
      }
    },

    advanceStep: async (noteId: number) => {
      const note = get().notes.find((n) => n.id === noteId);
      if (!note) return;

      const nextStep = Math.min(note.currentStep + 1, 4) as 1 | 2 | 3 | 4;
      const updated: FeynmanNote = {
        ...note,
        currentStep: nextStep,
        updatedAt: new Date(),
      };

      // step 1 → 2：设置 in_progress
      if (note.currentStep === 1 && nextStep === 2) {
        updated.status = 'in_progress';
      }

      // 到达 step 4 且 simplifiedSummary 不为空 → 自动完成
      if (nextStep === 4) {
        const summary = get().summaries[noteId];
        if (summary && summary.summary.trim() !== '') {
          updated.status = 'completed';
          updated.completedAt = new Date();
        }
      }

      await feynmanNoteStore.update(noteId, updated);
      set((state) => ({ notes: patchNote(state.notes, updated) }));
    },

    setSelfRating: async (noteId: number, rating: number) => {
      const note = get().notes.find((n) => n.id === noteId);
      if (!note) return;

      const updated: FeynmanNote = { ...note, selfRating: rating, updatedAt: new Date() };
      await feynmanNoteStore.update(noteId, updated);
      set((state) => ({ notes: patchNote(state.notes, updated) }));
    },

    completeNote: async (noteId: number) => {
      const note = get().notes.find((n) => n.id === noteId);
      if (!note) return;

      const updated: FeynmanNote = {
        ...note,
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      };

      await feynmanNoteStore.update(noteId, updated);
      set((state) => ({ notes: patchNote(state.notes, updated) }));
    },

    // ── 批量加载 ──────────────────────────────────────────────

    loadWeakPointsForNotes: async (noteIds: number[]) => {
      if (noteIds.length === 0) return;
      const allWp = await feynmanWeakPointStore.getAll();
      const grouped: Record<number, FeynmanWeakPoint[]> = {};
      for (const id of noteIds) grouped[id] = [];
      for (const wp of allWp) {
        if (noteIds.includes(wp.noteId)) {
          (grouped[wp.noteId] ??= []).push(wp);
        }
      }
      set((state) => ({
        weakPoints: { ...state.weakPoints, ...grouped },
      }));
    },

    // ── 统计 ────────────────────────────────────────────────

    getStats: () => {
      const { notes, weakPoints } = get();
      const total = notes.length;
      const completed = notes.filter((n) => n.status === 'completed').length;
      const weakPointsCount = Object.values(weakPoints).reduce(
        (acc, wps) => acc + wps.filter((w) => !w.mastered).length,
        0,
      );
      return { total, completed, weakPointsCount };
    },

    // ── 便捷 getter ─────────────────────────────────────────

    getCurrentView: () => {
      const { notes, summaries, weakPoints, currentNoteId } = get();
      if (!currentNoteId) return null;
      const note = notes.find((n) => n.id === currentNoteId);
      if (!note) return null;
      return {
        note,
        summary: summaries[currentNoteId] ?? null,
        weakPoints: weakPoints[currentNoteId] ?? [],
      };
    },
  };
});
