/**
 * 采集会话管理器
 * 封装截图 + 视觉提取 + 语音转写 + 流水线的完整采集会话生命周期
 * 集成 RouteDispatcher 实现智能路由调度
 */

import { Pipeline } from './pipeline';
import { CrossFusionEngine } from './crossFusion';
import { RouteDispatcher } from '@/lib/ai/routeDispatcher';
import type { RouteDispatcherConfig, RouteDecision } from '@/lib/ai/routeDispatcher';
import { VisionWorker } from '@/lib/ai/visionWorker';
import { ASRWorker } from '@/lib/ai/asrWorker';
import { captureEventBus } from './eventBus';
import { captureStore } from '@/lib/storage/captureStore';
import type {
  CaptureSessionConfig,
  ExtractionResult,
  PipelineMessage,
  ScreenshotData,
  AudioChunkData,
} from './captureTypes';

// ================================================================
// CaptureManager
// ================================================================

export class CaptureManager {
  private pipeline: Pipeline;
  private dispatcher: RouteDispatcher;
  private crossFusion: CrossFusionEngine;
  private visionWorker: VisionWorker;
  private asrWorker: ASRWorker | null = null;
  private sessionId: string | null = null;
  private sessionConfig: CaptureSessionConfig | null = null;
  private frameCount = 0;
  private extractedCount = 0;
  private lastDecision: RouteDecision | null = null;
  private fusionIntervalId: ReturnType<typeof setInterval> | null = null;
  private isPaused = false;

  constructor(options?: {
    apiBaseUrl?: string;
    routeConfig?: Partial<RouteDispatcherConfig>;
  }) {
    // apiBaseUrl 保留供未来直接使用，当前 VisionWorker 通过 aiClient 全局配置
    void options?.apiBaseUrl;

    this.crossFusion = new CrossFusionEngine(
      (segment) => {
        captureEventBus.emit('fusion:segment_complete', {
          sessionId: this.sessionId,
          segment,
        });
      },
    );

    this.dispatcher = new RouteDispatcher(options?.routeConfig);
    this.visionWorker = new VisionWorker();
    this.pipeline = new Pipeline({
      maxQueueSize: 50,
      batchSize: 1,
      processingTimeout: 60_000, // 视觉提取可能需要较长时间
      onResult: (result, message) => this.handleResult(result, message),
      onError: (error, message) => this.handleError(error, message),
    });

    // 视觉 Worker 始终注册（最通用的路径）
    this.pipeline.registerWorker(this.visionWorker);
    this.dispatcher.registerWorker(this.visionWorker);
  }

  // ================================================================
  // 公共 API
  // ================================================================

  /**
   * 开始采集会话
   * 创建持久化会话记录，通过 RouteDispatcher 决策启用哪些 Worker，并初始化流水线状态
   */
  async startSession(config: CaptureSessionConfig): Promise<string> {
    if (this.sessionId) {
      console.warn('[CaptureManager] Session already active, stopping previous session');
      await this.stopSession();
    }

    // 通过 RouteDispatcher 做出路由决策
    this.lastDecision = this.dispatcher.decide({
      hasWindowAccess: !!config.windowId,
      hasAudioSource: config.audioEnabled,
      uiAutomationAvailable: false, // Electron 环境下后续检测
    });

    console.log(`[CaptureManager] Route decision: ${this.lastDecision.reason}`);

    // 根据决策动态注册 ASR Worker
    if (this.lastDecision.audioEnabled && !this.asrWorker) {
      this.asrWorker = new ASRWorker();
      this.pipeline.registerWorker(this.asrWorker);
      this.dispatcher.registerWorker(this.asrWorker);
      console.log('[CaptureManager] ASR Worker registered per route decision');
    } else if (!this.lastDecision.audioEnabled && this.asrWorker) {
      this.pipeline.unregisterWorker('asr-worker');
      this.dispatcher.unregisterWorker('asr-worker');
      this.asrWorker = null;
      console.log('[CaptureManager] ASR Worker unregistered per route decision');
    }

    // 创建持久化会话
    const session = await captureStore.createSession({
      targetWindow: config.windowTitle,
      mode: this.lastDecision.audioEnabled ? 'both' : 'vision',
      status: 'active',
      segments: [],
    });

    this.sessionId = session.id;
    this.sessionConfig = config;
    this.frameCount = 0;
    this.extractedCount = 0;

    captureEventBus.emit('session:started', {
      sessionId: this.sessionId,
      config,
      routeDecision: this.lastDecision,
    });

    // 定期触发融合（每 3 秒）
    this.fusionIntervalId = setInterval(() => {
      if (this.sessionId) {
        this.crossFusion.fuseByTimeWindow();
      }
    }, 3000);

    console.log(`[CaptureManager] Session started: ${this.sessionId}`);
    return this.sessionId;
  }

  /**
   * 停止采集会话
   * 清空流水线队列，重置调度器，更新会话状态
   */
  async stopSession(): Promise<void> {
    if (!this.sessionId) return;

    this.pipeline.clear();
    this.dispatcher.reset();
    this.crossFusion.reset();
    this.lastDecision = null;
    this.isPaused = false;

    if (this.fusionIntervalId !== null) {
      clearInterval(this.fusionIntervalId);
      this.fusionIntervalId = null;
    }

    await captureStore.updateSession(this.sessionId, {
      status: 'completed',
      endedAt: new Date(),
    });

    captureEventBus.emit('session:stopped', {
      sessionId: this.sessionId,
      frameCount: this.frameCount,
      extractedCount: this.extractedCount,
    });

    console.log(`[CaptureManager] Session stopped: ${this.sessionId}`);
    this.sessionId = null;
    this.sessionConfig = null;
  }

  /**
   * 推送截图帧到流水线
   */
  pushFrame(frameData: ScreenshotData): void {
    if (!this.sessionId) {
      console.warn('[CaptureManager] No active session, dropping frame');
      return;
    }

    // 检查路由决策是否启用视觉通道
    if (this.lastDecision && !this.lastDecision.visionEnabled) {
      return;
    }

    if (this.isPaused) {
      return;
    }

    const message = this.pipeline.createMessage<ScreenshotData>(
      'screenshot',
      this.sessionId,
      frameData,
    );

    const accepted = this.pipeline.push(message);
    if (accepted) {
      this.frameCount++;
      captureEventBus.emit('frame:pushed', {
        sessionId: this.sessionId,
        messageId: message.id,
        frameCount: this.frameCount,
      });
    }
  }

  /**
   * 推送音频块到流水线
   */
  pushAudioChunk(audioData: AudioChunkData): void {
    if (!this.sessionId) {
      console.warn('[CaptureManager] No active session, dropping audio chunk');
      return;
    }

    // 检查路由决策是否启用音频通道
    if (this.lastDecision && !this.lastDecision.audioEnabled) {
      return;
    }

    if (this.isPaused) {
      return;
    }

    // VAD 检测：通过 CrossFusionEngine 判断是否有语音活动
    const voiceActive = this.crossFusion.detectVoiceActivity(audioData.audioBuffer);
    if (voiceActive) {
      this.crossFusion.requestVisionCapture();
    }

    const message = this.pipeline.createMessage<AudioChunkData>(
      'audio_chunk',
      this.sessionId,
      audioData,
    );

    this.pipeline.push(message);
  }

  /**
   * 暂停采集（停止接收新数据，但保持会话状态）
   */
  pauseSession(): void {
    if (!this.sessionId || this.isPaused) return;
    this.isPaused = true;
    this.pipeline.clear();
    console.log('[CaptureManager] Session paused');
  }

  /**
   * 恢复采集
   */
  resumeSession(): void {
    if (!this.sessionId || !this.isPaused) return;
    this.isPaused = false;
    console.log('[CaptureManager] Session resumed');
  }

  /**
   * 获取当前会话状态
   */
  getStatus(): {
    sessionId: string | null;
    pipeline: { queueSize: number; workerCount: number; isProcessing: boolean };
    frameCount: number;
    extractedCount: number;
    routeDecision: RouteDecision | null;
  } {
    return {
      sessionId: this.sessionId,
      pipeline: this.pipeline.getStatus(),
      frameCount: this.frameCount,
      extractedCount: this.extractedCount,
      routeDecision: this.lastDecision,
    };
  }

  /**
   * 获取 RouteDispatcher 实例（供外部高级用法）
   */
  getDispatcher(): RouteDispatcher {
    return this.dispatcher;
  }

  /**
   * 销毁管理器，释放所有资源
   */
  dispose(): void {
    if (this.sessionId) {
      // 异步停止但不等待（dispose 是同步方法）
      this.stopSession().catch(err => {
        console.error('[CaptureManager] Error stopping session during dispose:', err);
      });
    }
    if (this.fusionIntervalId !== null) {
      clearInterval(this.fusionIntervalId);
      this.fusionIntervalId = null;
    }
    this.pipeline.dispose();
    this.dispatcher.dispose();
    this.crossFusion.reset();
    this.asrWorker = null;
    captureEventBus.off('session:started');
    captureEventBus.off('session:stopped');
    captureEventBus.off('frame:pushed');
    captureEventBus.off('fusion:vad_triggered');
    captureEventBus.off('fusion:segment_complete');
    console.log('[CaptureManager] Disposed');
  }

  // ================================================================
  // 私有方法
  // ================================================================

  /**
   * 处理流水线提取结果
   * 向 RouteDispatcher 报告执行成功，并持久化 + 广播提取结果
   */
  private handleResult(result: ExtractionResult, message: PipelineMessage): void {
    if (!this.sessionId) return;

    this.extractedCount++;

    // 向调度器报告成功
    const routeSource = result.source === 'audio' ? 'audio' as const
      : result.source === 'ui_automation' ? 'uiAutomation' as const
      : 'vision' as const;
    this.dispatcher.reportResult(routeSource, true, result.confidence);

    // 持久化片段到 captureStore
    const segment = {
      id: `seg-${Date.now()}-${this.extractedCount}`,
      timestamp: new Date(),
      source: result.source,
      text: result.text,
      confidence: result.confidence,
      metadata: {
        model: result.model,
        processingTimeMs: result.processingTimeMs,
        language: this.sessionConfig?.language,
      },
    };

    captureStore.addSegment(this.sessionId, segment).catch(err => {
      console.error('[CaptureManager] Failed to persist segment:', err);
    });

    // 将结果送入 CrossFusionEngine 进行交叉融合
    if (result.source === 'vision') {
      this.crossFusion.addVisionResult(
        Date.now(),
        result.text,
        result.confidence,
        result.structured,
      );
    } else if (result.source === 'audio') {
      const segments = result.structured?.segments as
        | Array<{ start: number; end: number; text: string }>
        | undefined;
      this.crossFusion.addAudioResult(
        Date.now(),
        result.text,
        result.confidence,
        segments,
      );
    }

    // 通过事件总线广播提取结果
    captureEventBus.emit('extraction:completed', {
      sessionId: this.sessionId,
      messageId: message.id,
      result,
      segment,
      extractedCount: this.extractedCount,
    });
  }

  /**
   * 处理流水线错误
   * 向 RouteDispatcher 报告失败，触发降级逻辑
   */
  private handleError(error: Error, message: PipelineMessage): void {
    console.error(`[CaptureManager] Pipeline error for message ${message.id}:`, error);

    // 根据消息类型推断失败的路由通道并报告
    const routeMap: Record<string, 'vision' | 'audio' | 'uiAutomation'> = {
      screenshot: 'vision',
      audio_chunk: 'audio',
      ui_text: 'uiAutomation',
    };
    const route = routeMap[message.type];
    if (route) {
      const newDecision = this.dispatcher.handleFailure(route, error);
      this.lastDecision = newDecision;
      console.warn(`[CaptureManager] Route decision updated after failure: ${newDecision.reason}`);
    }

    captureEventBus.emit('extraction:error', {
      sessionId: this.sessionId,
      messageId: message.id,
      error: error.message,
    });
  }
}
