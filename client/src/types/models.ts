// 番茄钟会话记录
export interface PomodoroSession {
  id: string;
  mode: 'class' | 'self_study';  // 上课模式 / 自习模式
  subject?: string;              // 科目（可选）
  duration: number;              // 计划时长（秒）
  actualDuration: number;        // 实际专注时长（秒）
  completedAt: Date;             // 完成时间
  interrupted: boolean;          // 是否中断
  goal?: string;                 // 本次番茄目标（可选）
}

// 番茄钟配置
export interface PomodoroSettings {
  id: string;
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
  id: string;
  title: string;
  content: string;               // TipTap JSON 内容
  template: 'outline' | 'cornell' | 'mindmap' | 'free' | 'qa' | 'blank' | 'video';
  folderId?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  wordCount: number;
  pinned: boolean;               // 是否置顶
  videoNoteType?: string;         // 视频笔记类型标识（lecture/tutorial/etc）
}

// 笔记文件夹
export interface NoteFolder {
  id: string;
  name: string;
  parentId?: string;             // 支持嵌套文件夹
  color?: string;                // 文件夹颜色标识
  createdAt: Date;
  order: number;                 // 排序权重
}

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
}

// 费曼学习笔记
export interface FeynmanNote {
  id: string;
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
  id: string;
  noteId: string;                // 关联 feynmanNotes.id
  summary: string;               // 简化重述内容
  createdAt: Date;
  updatedAt: Date;
}

// 费曼薄弱点（第二步）
export interface FeynmanWeakPoint {
  id: string;
  noteId: string;
  text: string;
  position: { start: number; end: number };
  mastered: boolean;
  createdAt: Date;
}

// 操作日志（为后续同步预留）
export interface OperationLog {
  id: string;
  entityType: string;            // 'note' | 'flashcard' | 'pomodoro' | 'feynman' 等
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload?: string;              // JSON 格式的变更数据
  createdAt: Date;
  synced: boolean;               // 是否已同步到云端
  // MVP-2 新增同步字段
  version: number;
  deviceId: string;
  patch?: string;
}

// 应用设置
export interface AppSettings {
  id: string;
  key: string;                   // 设置键名
  value: string;                 // 设置值（JSON 字符串）
  updatedAt: Date;
}

// MVP-2 同步相关接口
export interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  localData: string;  // JSON serialized
  remoteData: string; // JSON serialized
  localVersion: number;
  remoteVersion: number;
  status: 'pending' | 'resolved-local' | 'resolved-remote' | 'resolved-manual';
  createdAt: Date;
  resolvedAt?: Date;
}

export interface OfflineQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload?: string;
  version: number;
  deviceId: string;
  createdAt: Date;
  retryCount: number;
  /** 下次可重试的时间戳（ms），未设置或已过期表示可立即重试 */
  nextRetryAt?: number;
}

// 学习打卡记录
export interface StudyCheckIn {
  id: string;
  date: string;           // YYYY-MM-DD
  checkInTime: Date;
  modulesUsed: string[];  // 当日使用的模块名称列表
  streakDays: number;     // 连续打卡天数
}

// 成就解锁记录
export interface Achievement {
  id: string;
  key: string;            // 成就唯一标识
  title: string;
  description: string;
  icon: string;           // 图标名称或路径
  unlockedAt: Date;
}

// 番茄目标记忆
export interface PomodoroGoal {
  id: string;
  text: string;           // 目标文字
  useCount: number;       // 使用次数（用于排序）
  lastUsedAt: Date;
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

// 自由画布文本块
export interface FreeCanvasBlock {
  id: string;
  type: 'text';
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number | 'auto' };
}

// 自由画布数据
export interface FreeCanvasData {
  blocks: FreeCanvasBlock[];
  canvasWidth: number;
  canvasHeight: number;
}

// ========== v0.4.0 混合方案新增类型 ==========

// 窗口捕获会话
export interface WindowCapture {
  id: string;
  noteId?: string;              // 关联笔记（可选）
  targetWindow: string;         // 目标窗口标题
  mode: 'vision' | 'audio' | 'both';  // 采集模式
  status: 'active' | 'paused' | 'completed';
  segments: ExtractedSegment[]; // 提取的内容片段
  startedAt: Date;
  endedAt?: Date;
  totalDuration?: number;       // 总时长（秒）
}

// 提取的内容片段
export interface ExtractedSegment {
  id: string;
  timestamp: Date;              // 提取时间
  source: 'vision' | 'audio' | 'ui_automation';  // 内容来源
  text: string;                 // 提取的文本内容
  confidence?: number;          // 置信度 (0-1)
  metadata?: SegmentMetadata;   // 附加元数据
}

// 片段元数据
export interface SegmentMetadata {
  startTime?: number;           // 音频/视频起始时间（秒）
  endTime?: number;             // 音频/视频结束时间（秒）
  imageUrl?: string;            // 关联截图（临时路径）
  language?: string;            // 检测到的语言
  model?: string;               // 使用的 AI 模型
  processingTimeMs?: number;    // 处理耗时（毫秒）
}

// 视频笔记元数据（嵌入 TipTap JSON content）
export interface VideoNoteMeta {
  videoUrl?: string;
  duration?: number;
  platform?: string;
  captureSessionId?: string;    // 关联的 WindowCapture 会话 ID
}

// 采集配置
export interface CaptureConfig {
  windowId: string;             // 目标窗口 ID
  windowTitle: string;          // 目标窗口标题
  screenshotInterval: number;   // 截图间隔（毫秒），默认 5000
  mode: 'vision' | 'audio' | 'both';
  autoInsert: boolean;          // 是否自动插入到笔记
  language: string;             // 识别语言，默认 'zh'
}

// 窗口信息
export interface WindowInfo {
  id: string;
  title: string;
  appName?: string;
  isMinimized?: boolean;
}

// 采集事件（用于事件总线通信）
export interface CaptureEvent {
  type: 'screenshot' | 'audio_chunk' | 'ui_text' | 'extracted' | 'error';
  timestamp: number;            // 单调递增时间戳
  data: unknown;                // 事件数据（具体类型由 type 决定）
  sessionId: string;
}

// 隐私合规同意记录
export interface Consent {
  id: string;
  type: 'privacy' | 'terms';
  version: string;
  acceptedAt: Date;
}
