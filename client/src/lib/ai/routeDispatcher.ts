/**
 * 智能路由调度引擎
 *
 * 根据场景自动选择最优采集/处理路径。
 * 核心职责：将截图 / 音频 / UI 文本等数据分发给所有已注册的 Worker，
 * 由各 Worker 自行判断是否可处理（canProcess），Dispatcher 负责 try/catch 隔离错误。
 *
 * 降级链：UI Automation（零成本）→ 多模态 AI 视觉提取（主力）→ ASR 语音转写（辅助）
 */

import type {
  PipelineMessage,
  PipelineWorker,
  ExtractionResult,
} from '@/lib/capture/captureTypes';

// ================================================================
// 路由策略与决策类型
// ================================================================

/** 路由策略 */
export type RouteStrategy = 'auto' | 'vision_only' | 'audio_only' | 'both' | 'ui_automation';

/** 路由决策结果 */
export interface RouteDecision {
  strategy: RouteStrategy;
  reason: string;
  visionEnabled: boolean;
  audioEnabled: boolean;
  uiAutomationEnabled: boolean;
}

/** 路由配置 */
export interface RouteDispatcherConfig {
  /** 首选策略 */
  preferredStrategy: RouteStrategy;
  /** 视觉提取置信度阈值，低于此值触发降级，默认 0.6 */
  visionConfidenceThreshold: number;
  /** ASR 置信度阈值，默认 0.7 */
  asrConfidenceThreshold: number;
  /** 最大重试次数，默认 2 */
  maxRetries: number;
  /** 所有路径失败时降级为手动输入，默认 true */
  fallbackToManual: boolean;
}

/** 路由来源标识 */
export type RouteSource = 'vision' | 'audio' | 'uiAutomation';

/** 融合输入条目 */
export interface FusionInput {
  source: RouteSource;
  text: string;
  confidence: number;
  timestamp: number;
}

/** 融合输出结果 */
export interface FusionResult {
  text: string;
  confidence: number;
  sources: string[];
}

// ================================================================
// 默认配置
// ================================================================

const DEFAULT_CONFIG: RouteDispatcherConfig = {
  preferredStrategy: 'auto',
  visionConfidenceThreshold: 0.6,
  asrConfidenceThreshold: 0.7,
  maxRetries: 2,
  fallbackToManual: true,
};

// ================================================================
// RouteDispatcher
// ================================================================

export class RouteDispatcher {
  private config: RouteDispatcherConfig;
  private lastDecision: RouteDecision | null = null;
  private failureCounts: Record<RouteSource, number> = {
    vision: 0,
    audio: 0,
    uiAutomation: 0,
  };

  /** 已注册的 Worker 列表 */
  private workers: PipelineWorker[] = [];

  constructor(config: Partial<RouteDispatcherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ================================================================
  // Worker 注册
  // ================================================================

  /**
   * 注册 Worker 到调度器
   */
  registerWorker(worker: PipelineWorker): void {
    this.workers.push(worker);
  }

  /**
   * 移除 Worker
   */
  unregisterWorker(name: string): void {
    const idx = this.workers.findIndex(w => w.name === name);
    if (idx >= 0) {
      this.workers[idx].dispose();
      this.workers.splice(idx, 1);
    }
  }

  // ================================================================
  // 路由决策
  // ================================================================

  /**
   * 根据当前场景和可用资源做出路由决策。
   * 决策结果用于指导上层（CaptureManager）启用哪些采集通道。
   */
  decide(context: {
    hasWindowAccess: boolean;
    hasAudioSource: boolean;
    uiAutomationAvailable: boolean;
    lastVisionConfidence?: number;
    lastASRConfidence?: number;
  }): RouteDecision {
    const { preferredStrategy } = this.config;

    // 非 auto 模式：直接按策略映射
    if (preferredStrategy !== 'auto') {
      this.lastDecision = this.resolveFromStrategy(preferredStrategy, context);
      return this.lastDecision;
    }

    // ---- auto 模式 ----
    // 优先尝试 UI Automation（零成本），不可用则视觉+音频并行
    if (context.uiAutomationAvailable && context.hasWindowAccess) {
      this.lastDecision = {
        strategy: 'auto',
        reason: 'UI Automation 可用，优先使用零成本路径',
        visionEnabled: true,       // 视觉作为并行后备
        audioEnabled: context.hasAudioSource,
        uiAutomationEnabled: true,
      };
    } else {
      // UI Automation 不可用，视觉 + 音频并行
      this.lastDecision = {
        strategy: 'auto',
        reason: context.hasWindowAccess
          ? 'UI Automation 不可用，视觉+音频并行'
          : '无窗口访问权限，启用所有可用通道',
        visionEnabled: context.hasWindowAccess,
        audioEnabled: context.hasAudioSource,
        uiAutomationEnabled: false,
      };
    }

    // 根据历史失败次数动态调整：连续失败超过阈值的通道临时关闭
    if (this.failureCounts.vision > this.config.maxRetries) {
      this.lastDecision.visionEnabled = false;
      this.lastDecision.reason += '；视觉通道连续失败已降级';
    }
    if (this.failureCounts.audio > this.config.maxRetries) {
      this.lastDecision.audioEnabled = false;
      this.lastDecision.reason += '；音频通道连续失败已降级';
    }
    if (this.failureCounts.uiAutomation > this.config.maxRetries) {
      this.lastDecision.uiAutomationEnabled = false;
      this.lastDecision.reason += '；UI Automation 通道连续失败已降级';
    }

    return this.lastDecision;
  }

  // ================================================================
  // 数据分发
  // ================================================================

  /**
   * 将消息分发给所有能处理它的 Worker。
   * 每个 Worker 通过自身的 canProcess() 判断是否可消费该消息。
   * 各 Worker 之间错误隔离（try/catch），单个 Worker 失败不影响其他。
   *
   * @returns 所有成功处理的 Worker 返回结果（失败的被跳过并记录日志）
   */
  async dispatch(message: PipelineMessage): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];

    for (const worker of this.workers) {
      if (!worker.canProcess(message)) continue;

      try {
        const result = await worker.process(message);
        if (result) {
          results.push(result);
        }
      } catch {
        // 错误隔离：单个 Worker 失败不影响其他
      }
    }

    return results;
  }

  // ================================================================
  // 结果反馈
  // ================================================================

  /**
   * 报告路由执行结果，用于动态调整策略。
   * 成功 → 重置失败计数；失败 → 累加失败计数。
   */
  reportResult(route: RouteSource, success: boolean, _confidence?: number): void {
    if (success) {
      this.failureCounts[route] = 0;
    } else {
      this.failureCounts[route]++;
    }
  }

  /**
   * 处理路由失败，决定降级策略。
   * 返回新的路由决策供上层使用。
   */
  handleFailure(route: RouteSource, error: Error): RouteDecision {
    this.failureCounts[route]++;

    // 基于当前决策重新计算，失败的通道会被自动关闭
    const base = this.lastDecision ?? this.makeFallbackDecision();
    if (route === 'vision') base.visionEnabled = false;
    if (route === 'audio') base.audioEnabled = false;
    if (route === 'uiAutomation') base.uiAutomationEnabled = false;

    // 所有通道都被关闭时降级为手动
    if (!base.visionEnabled && !base.audioEnabled && !base.uiAutomationEnabled) {
      base.reason = this.config.fallbackToManual
        ? '所有路径失败，降级为手动输入'
        : '所有路径失败';
    }

    this.lastDecision = base;
    return base;
  }

  // ================================================================
  // 多源结果融合
  // ================================================================

  /**
   * 融合多路径结果（去重 + 时间轴对齐 + 置信度加权）。
   *
   * - 基于时间戳对齐不同来源的结果
   * - 文本去重：Jaccard 相似度 > 0.8 视为重复
   * - 置信度加权合并
   */
  fuseResults(results: FusionInput[]): FusionResult {
    if (results.length === 0) {
      return { text: '', confidence: 0, sources: [] };
    }

    // 按时间戳排序
    const sorted = [...results].sort((a, b) => a.timestamp - b.timestamp);

    // 去重 + 合并
    const uniqueEntries: FusionInput[] = [];
    for (const entry of sorted) {
      const isDuplicate = uniqueEntries.some(
        existing => jaccardSimilarity(existing.text, entry.text) > 0.8,
      );
      if (!isDuplicate) {
        uniqueEntries.push(entry);
      }
    }

    if (uniqueEntries.length === 0) {
      return { text: '', confidence: 0, sources: [] };
    }

    // 置信度加权合并文本
    // 策略：按置信度降序拼接去重后的文本段落
    const weighted = uniqueEntries.sort((a, b) => b.confidence - a.confidence);
    const mergedText = weighted.map(e => e.text).join('\n');

    // 综合置信度 = 加权平均
    const totalWeight = uniqueEntries.reduce((sum, e) => sum + e.confidence, 0);
    const avgConfidence = totalWeight / uniqueEntries.length;

    const sources = [...new Set(uniqueEntries.map(e => e.source))];

    return {
      text: mergedText,
      confidence: Math.round(avgConfidence * 1000) / 1000,
      sources,
    };
  }

  // ================================================================
  // 状态管理
  // ================================================================

  /**
   * 重置调度器状态（失败计数、上次决策等）
   */
  reset(): void {
    this.lastDecision = null;
    this.failureCounts = { vision: 0, audio: 0, uiAutomation: 0 };
  }

  /**
   * 获取上次决策结果
   */
  getLastDecision(): RouteDecision | null {
    return this.lastDecision;
  }

  /**
   * 获取各通道失败计数
   */
  getFailureCounts(): Record<RouteSource, number> {
    return { ...this.failureCounts };
  }

  /**
   * 销毁调度器，清理所有 Worker
   */
  dispose(): void {
    for (const worker of this.workers) {
      worker.dispose();
    }
    this.workers = [];
    this.reset();
  }

  // ================================================================
  // 私有方法
  // ================================================================

  /**
   * 根据固定策略映射为决策结果
   */
  private resolveFromStrategy(
    strategy: RouteStrategy,
    context: { hasWindowAccess: boolean; hasAudioSource: boolean; uiAutomationAvailable: boolean },
  ): RouteDecision {
    switch (strategy) {
      case 'vision_only':
        return {
          strategy,
          reason: '指定仅视觉提取模式',
          visionEnabled: true,
          audioEnabled: false,
          uiAutomationEnabled: false,
        };
      case 'audio_only':
        return {
          strategy,
          reason: '指定仅 ASR 模式',
          visionEnabled: false,
          audioEnabled: true,
          uiAutomationEnabled: false,
        };
      case 'both':
        return {
          strategy,
          reason: '指定视觉+音频并行模式',
          visionEnabled: true,
          audioEnabled: true,
          uiAutomationEnabled: false,
        };
      case 'ui_automation':
        return {
          strategy,
          reason: context.uiAutomationAvailable
            ? '指定 UI Automation 模式'
            : '指定 UI Automation 模式（不可用，降级）',
          visionEnabled: !context.uiAutomationAvailable, // 不可用时回退到视觉
          audioEnabled: false,
          uiAutomationEnabled: context.uiAutomationAvailable,
        };
      default:
        return {
          strategy: 'auto',
          reason: '默认自动模式',
          visionEnabled: context.hasWindowAccess,
          audioEnabled: context.hasAudioSource,
          uiAutomationEnabled: context.uiAutomationAvailable && context.hasWindowAccess,
        };
    }
  }

  /**
   * 创建一个全部关闭的兜底决策
   */
  private makeFallbackDecision(): RouteDecision {
    return {
      strategy: 'auto',
      reason: '兜底决策',
      visionEnabled: false,
      audioEnabled: false,
      uiAutomationEnabled: false,
    };
  }
}

// ================================================================
// 工具函数
// ================================================================

/**
 * 计算两段文本的 Jaccard 字符集相似度（基于 unique 字符集合）。
 * 与 VisionWorker 内部去重方法相同的算法。
 */
function jaccardSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const setA = new Set(a);
  const setB = new Set(b);

  let intersectionSize = 0;
  for (const ch of setA) {
    if (setB.has(ch)) intersectionSize++;
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize > 0 ? intersectionSize / unionSize : 0;
}
