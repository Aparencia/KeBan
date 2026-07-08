// 番茄钟会话记录
export interface PomodoroSession {
  id?: number;
  mode: 'class' | 'self_study';  // 上课模式 / 自习模式
  subject?: string;              // 科目（可选）
  duration: number;              // 计划时长（秒）
  actualDuration: number;        // 实际专注时长（秒）
  completedAt: Date;             // 完成时间
  interrupted: boolean;          // 是否中断
}

// 番茄钟配置
export interface PomodoroSettings {
  id?: number;
  workDuration: number;          // 工作时长（分钟），默认 25
  shortBreakDuration: number;    // 短休息（分钟），默认 5
  longBreakDuration: number;     // 长休息（分钟），默认 15
  longBreakInterval: number;     // 几个番茄后长休息，默认 4
  autoStartBreak: boolean;       // 自动开始休息
  autoStartWork: boolean;        // 自动开始下一个番茄
  soundEnabled: boolean;         // 声音提醒
  notificationEnabled: boolean;  // 浏览器通知
  classDuration: number;         // 上课模式课堂时长（分钟），默认 45
}

// 笔记
export interface Note {
  id?: number;
  title: string;
  content: string;               // TipTap JSON 内容
  template: 'outline' | 'cornell' | 'mindmap' | 'free' | 'qa' | 'blank';
  folderId?: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  wordCount: number;
  pinned: boolean;               // 是否置顶
}

// 笔记文件夹
export interface NoteFolder {
  id?: number;
  name: string;
  parentId?: number;             // 支持嵌套文件夹
  color?: string;                // 文件夹颜色标识
  createdAt: Date;
  order: number;                 // 排序权重
}

// 闪卡牌组
export interface FlashcardDeck {
  id?: number;
  name: string;
  description?: string;
  parentId?: number;             // 支持嵌套牌组
  color?: string;
  createdAt: Date;
  updatedAt: Date;
  order: number;
}

// 闪卡
export interface Flashcard {
  id?: number;
  deckId: number;
  front: string;                 // 正面内容（支持 HTML/Markdown）
  back: string;                  // 背面内容
  type: 'basic' | 'cloze' | 'multi_choice';  // 卡片类型
  // SM-2 算法字段
  easeFactor: number;            // 难度因子，初始 2.5
  interval: number;              // 当前间隔（天）
  repetitions: number;           // 连续正确次数
  dueDate: Date;                 // 下次复习日期
  lastReviewDate?: Date;         // 上次复习日期
  createdAt: Date;
  updatedAt: Date;
  order: number;
}

// 闪卡复习记录
export interface FlashcardReview {
  id?: number;
  cardId: number;
  deckId: number;
  rating: 1 | 2 | 3 | 4;       // Again(1) / Hard(2) / Good(3) / Easy(4)
  easeFactorBefore: number;
  easeFactorAfter: number;
  intervalBefore: number;
  intervalAfter: number;
  reviewedAt: Date;
  timeSpent: number;             // 本次复习耗时（秒）
}

// 费曼学习笔记
export interface FeynmanNote {
  id?: number;
  concept: string;               // 学习的概念
  explanation: string;           // 讲解内容（第一步）
  status: 'not_started' | 'in_progress' | 'completed';
  currentStep: 1 | 2 | 3 | 4;  // 当前步骤
  selfRating?: number;           // 理解深度自评 1-5
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// 费曼简化总结（第四步）
export interface FeynmanSummary {
  id?: number;
  noteId: number;                // 关联 feynmanNotes.id
  summary: string;               // 简化重述内容
  createdAt: Date;
  updatedAt: Date;
}

// 费曼薄弱点（第二步）
export interface FeynmanWeakPoint {
  id?: number;
  noteId: number;
  text: string;
  position: { start: number; end: number };
  mastered: boolean;
  createdAt: Date;
}

// 操作日志（为后续同步预留）
export interface OperationLog {
  id?: number;
  entityType: string;            // 'note' | 'flashcard' | 'pomodoro' | 'feynman' 等
  entityId: number | string;
  operation: 'create' | 'update' | 'delete';
  payload?: string;              // JSON 格式的变更数据
  createdAt: Date;
  synced: boolean;               // 是否已同步到云端
}

// 应用设置
export interface AppSettings {
  id?: number;
  key: string;                   // 设置键名
  value: string;                 // 设置值（JSON 字符串）
  updatedAt: Date;
}
