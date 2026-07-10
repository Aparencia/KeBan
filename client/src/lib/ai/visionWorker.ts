/**
 * 视觉提取 Worker
 *
 * 实现 PipelineWorker 接口，将截图发送给多模态 AI 模型进行内容提取。
 * 通过 ai-gateway 的 /api/v1/vision/extract 端点调用 GLM-4V-Flash / Qwen-VL-Plus。
 */

import type {
  PipelineMessage,
  PipelineWorker,
  ExtractionResult,
  ScreenshotData,
} from '@/lib/capture/captureTypes';
import { aiClient } from '@/lib/http/apiClient';

// ================================================================
// 视觉提取模式类型
// ================================================================

/** 视觉提取模式 */
export type VisionExtractMode = 'auto' | 'text' | 'formula' | 'diagram' | 'code' | 'full';

/** 代码块结构 */
export interface CodeBlock {
  language: string;
  code: string;
}

/** 视觉提取选项 */
export interface VisionExtractOptions {
  /** 提取模式，默认 'auto' */
  mode?: VisionExtractMode;
}

// ================================================================
// 响应类型（与后端 VisionExtractResponse 对应）
// ================================================================

interface VisionExtractApiResponse {
  text: string;
  formulas: string[];
  diagrams: string[];
  key_points: string[];
  code_blocks: CodeBlock[];
  concepts: string[];
  confidence: number;
  model_used: string;
  processing_time_ms: number;
  mode: VisionExtractMode;
}

// ================================================================
// VisionWorker
// ================================================================

/** VisionWorker 配置 */
interface VisionWorkerOptions {
  /** 两次处理之间的最小时间间隔（ms），默认 3000 */
  minProcessInterval?: number;
  /** Jaccard 字符集相似度阈值，超过则跳过，默认 0.9 */
  similarityThreshold?: number;
  /** 默认提取模式，默认 'auto' */
  defaultMode?: VisionExtractMode;
}

export class VisionWorker implements PipelineWorker {
  name = 'vision-worker';

  private lastProcessedText = '';
  private lastProcessTime = 0;
  private readonly minProcessInterval: number;
  private readonly similarityThreshold: number;

  private readonly defaultMode: VisionExtractMode;

  constructor(options: VisionWorkerOptions = {}) {
    this.minProcessInterval = options.minProcessInterval ?? 3000;
    this.similarityThreshold = options.similarityThreshold ?? 0.9;
    this.defaultMode = options.defaultMode ?? 'auto';
  }

  canProcess(message: PipelineMessage): boolean {
    return message.type === 'screenshot';
  }

  async process(message: PipelineMessage): Promise<ExtractionResult | null> {
    const screenshotData = message.data as ScreenshotData;

    // 1. 跳过未变化的帧（由截图模块变化检测设置）
    if (!screenshotData.hasChanged) {
      return null;
    }

    // 2. 时间间隔去重：避免短时间内重复调用 AI
    const now = Date.now();
    if (now - this.lastProcessTime < this.minProcessInterval) {
      return null;
    }

    // 将 ArrayBuffer 转为 base64
    const base64 = arrayBufferToBase64(screenshotData.imageBuffer);

    // 从 metadata 中获取提取模式，或使用默认值
    const mode = (message.metadata?.visionMode as VisionExtractMode) ?? this.defaultMode;

    // 调用后端视觉提取 API
    const response = await aiClient.post<VisionExtractApiResponse>(
      '/api/v1/vision/extract',
      {
        image_base64: base64,
        language: 'zh',
        mode,
      },
    );

    // 3. 内容相似度去重：提取文本与上次高度相似则跳过
    if (response.text && this.isSimilarToLast(response.text)) {
      return null;
    }

    // 更新去重状态
    if (response.text) {
      this.lastProcessedText = response.text;
      this.lastProcessTime = now;
    }

    // 转换为 ExtractionResult
    return {
      text: response.text,
      confidence: response.confidence,
      source: 'vision',
      model: response.model_used,
      processingTimeMs: response.processing_time_ms,
      structured: {
        formulas: response.formulas,
        diagrams: response.diagrams,
        keyPoints: response.key_points,
        codeBlocks: response.code_blocks,
        concepts: response.concepts,
        mode: response.mode,
      },
    };
  }

  dispose(): void {
    this.lastProcessedText = '';
    this.lastProcessTime = 0;
  }

  // ================================================================
  // 内部去重方法
  // ================================================================

  /**
   * 判断当前文本与上次提取的文本是否高度相似
   * 使用 Jaccard 字符集相似度（基于 unique 字符集合）
   */
  private isSimilarToLast(text: string): boolean {
    if (!this.lastProcessedText) return false;

    const setA = new Set(this.lastProcessedText);
    const setB = new Set(text);

    let intersectionSize = 0;
    for (const ch of setA) {
      if (setB.has(ch)) intersectionSize++;
    }

    const unionSize = setA.size + setB.size - intersectionSize;
    return unionSize > 0 && intersectionSize / unionSize > this.similarityThreshold;
  }
}

// ================================================================
// 工具函数
// ================================================================

/** 将 ArrayBuffer 转为 base64 字符串 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
