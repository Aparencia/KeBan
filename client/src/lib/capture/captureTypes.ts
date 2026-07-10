/**
 * 采集模块核心类型定义
 * 用于混合方案的事件驱动异步流水线架构
 */

// 采集事件类型
export type CaptureEventType = 'screenshot' | 'audio_chunk' | 'ui_text' | 'extracted' | 'error';

// 采集管道消息（在采集层和处理层之间传递）
export interface PipelineMessage<T = unknown> {
  id: string;
  type: CaptureEventType;
  timestamp: number;           // 单调递增时间戳（ms）
  sessionId: string;
  data: T;
  metadata?: Record<string, unknown>;
}

// 截图数据
export interface ScreenshotData {
  imageBuffer: ArrayBuffer;    // PNG 图片数据
  width: number;
  height: number;
  hasChanged: boolean;         // 变化检测结果
  changeScore?: number;        // 变化分数 (0-1)
}

// 音频块数据
export interface AudioChunkData {
  audioBuffer: ArrayBuffer;    // PCM 音频数据
  sampleRate: number;
  channels: number;
  durationMs: number;          // 音频块时长
}

// UI 文本数据
export interface UITextData {
  text: string;
  source: string;              // 来源窗口/元素
  elementPath?: string;        // UI 元素路径
}

// 提取结果（OCR/ASR/AI 处理后）
export interface ExtractionResult {
  text: string;
  confidence: number;          // 0-1
  source: 'vision' | 'audio' | 'ui_automation';
  model?: string;              // 使用的模型名称
  processingTimeMs: number;
  structured?: Record<string, unknown>;  // 结构化数据（如 LaTeX 公式、图表描述）
}

// Worker 处理器接口
export interface PipelineWorker {
  name: string;
  canProcess(message: PipelineMessage): boolean;
  process(message: PipelineMessage): Promise<ExtractionResult | null>;
  dispose(): void;
}

// 采集会话状态
export type SessionStatus = 'idle' | 'capturing' | 'processing' | 'paused' | 'error';

// 采集会话
export interface CaptureSession {
  id: string;
  status: SessionStatus;
  config: CaptureSessionConfig;
  startedAt: number;
  messageCount: number;
  processedCount: number;
  errorCount: number;
}

// 采集会话配置
export interface CaptureSessionConfig {
  windowId: string;
  windowTitle: string;
  screenshotInterval: number;  // 截图间隔 ms
  audioEnabled: boolean;
  language: string;
  autoInsert: boolean;
}

// 可捕获窗口信息（screen_list_windows 返回）
export interface WindowInfo {
  id: string;
  title: string;
  thumbnail?: string;          // base64 缩略图
}

// 提取片段（UI 展示用）
export interface ExtractedSegment {
  id: string;
  timestamp: number;
  source: 'vision' | 'audio' | 'ui_automation';
  text: string;
  confidence: number;
}

// 采集模式
export type CaptureMode = 'vision' | 'audio' | 'mixed';

// 侧边栏 UI 配置
export interface CaptureSidebarConfig {
  screenshotInterval: number;  // 截图间隔 ms
  language: 'zh' | 'en' | 'mixed';
  autoInsert: boolean;
  mode: CaptureMode;
}
