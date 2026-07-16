// ========== 闪卡相关类型 ==========

import type { Confidence } from './common';

// 闪卡牌组
export interface FlashcardDeck {
  id: string;
  name: string;
  description?: string;
  parentId?: string;             // 支持嵌套牌组
  color?: string;
  createdAt: Date;
  updatedAt: Date;
  order: number;
}

// 闪卡
export interface Flashcard {
  id: string;
  deckId: string;
  front: string;                 // 正面内容（支持 HTML/Markdown）
  back: string;                  // 背面内容
  type: 'basic' | 'cloze' | 'multi_choice';  // 卡片类型
  // SM-2 算法字段
  easeFactor: number;            // 难度因子，初始 2.5
  interval: number;              // 当前间隔（天）
  repetitions: number;           // 连续正确次数
  lapses: number;                // 累计失误次数
  dueDate: Date;                 // 下次复习日期
  lastReviewDate?: Date;         // 上次复习日期
  createdAt: Date;
  updatedAt: Date;
  sourceNoteId?: string;          // 来源笔记 ID（用于双向关联）
  order: number;
}

// 闪卡复习记录
export interface FlashcardReview {
  id: string;
  cardId: string;
  deckId: string;
  rating: 1 | 2 | 3 | 4;       // Again(1) / Hard(2) / Good(3) / Easy(4)
  easeFactorBefore: number;
  easeFactorAfter: number;
  intervalBefore: number;
  intervalAfter: number;
  reviewedAt: Date;
  timeSpent: number;             // 本次复习耗时（秒）
  /** v0.9.0: 本次复习自信度 */
  confidence?: Confidence;
  /** v0.9.0: 是否为黄金错误（高自信答错） */
  goldenError?: boolean;
}

// 牌组分享文件格式 (.kban-deck)
export interface KbanDeckFile {
  version: '1.0' | '1.1';
  type: 'deck';
  exportedAt: string;       // ISO 8601
  author?: string;          // v1.1 新增：导出者标识
  deck: {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    cardCount?: number;     // v1.1 新增：卡片数量提示
    tags?: string[];        // v1.1 新增：牌组标签
  };
  cards: Array<{
    front: string;           // TipTap JSON 字符串
    back: string;
    tags: string[];
    type?: 'basic' | 'cloze' | 'multi_choice';  // v1.1 新增
    sourceNoteId?: string;   // v1.1 新增：来源笔记关联
  }>;
}
