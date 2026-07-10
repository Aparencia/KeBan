/**
 * 音视频交叉融合模块
 * 协调视觉和音频两个通道的数据，实现智能联动
 *
 * 核心功能：
 * 1. VAD（Voice Activity Detection）驱动视觉抓取
 * 2. ASR/视觉文本去重对齐：基于时间轴对齐，合并重复内容
 * 3. 公式与语音联合校正：语音中的数学术语与视觉公式交叉验证
 */

import { captureEventBus } from './eventBus';

// ================================================================
// 类型定义
// ================================================================

/** VAD 配置 */
export interface VADConfig {
  /** 能量阈值，超过则视为有语音活动，默认 0.02 */
  energyThreshold: number;
  /** 静音持续时长（ms），超过则视为语音结束，默认 1500 */
  silenceDuration: number;
  /** 最短语音时长（ms），低于则忽略，默认 500 */
  minSpeechDuration: number;
}

/** 融合后的片段 */
export interface FusionSegment {
  id: string;
  /** 起始时间戳 */
  startTime: number;
  /** 结束时间戳 */
  endTime: number;
  /** 视觉提取文本 */
  visionText: string;
  /** ASR 转写文本 */
  audioText: string;
  /** 融合后文本 */
  mergedText: string;
  /** 综合置信度 */
  confidence: number;
  /** 是否包含公式 */
  hasFormula: boolean;
  sources: ('vision' | 'audio')[];
}

/** VAD 触发截图事件 */
export interface VADTriggerEvent {
  type: 'vad_triggered';
  timestamp: number;
}

// ================================================================
// 内部类型
// ================================================================

interface VisionResult {
  timestamp: number;
  text: string;
  confidence: number;
  structured?: Record<string, unknown>;
}

interface AudioResult {
  timestamp: number;
  text: string;
  confidence: number;
  segments?: Array<{ start: number; end: number; text: string }>;
}

// ================================================================
// 默认配置
// ================================================================

const DEFAULT_VAD_CONFIG: VADConfig = {
  energyThreshold: 0.02,
  silenceDuration: 1500,
  minSpeechDuration: 500,
};

const DEFAULT_FUSION_WINDOW_MS = 5000;

/** Jaccard 相似度阈值，超过则视为重复 */
const DEDUP_SIMILARITY_THRESHOLD = 0.75;

/** 数学相关术语，用于语音与公式交叉验证 */
const MATH_TERMS: string[] = [
  // 代数
  '二次方程', '一元二次', '方程', '导数', '微分', '积分', '极限',
  '级数', '矩阵', '行列式', '向量', '概率', '统计',
  // 几何
  '三角形', '圆', '椭圆', '双曲线', '抛物线', '直线', '平面', '坐标系',
  // 三角函数
  '正弦', '余弦', '正切', '三角函数',
  // 微积分
  '导函数', '反导数', '不定积分', '定积分', '偏导数',
  // LaTeX 关键词
  'frac', 'sqrt', 'int', 'sum', 'lim', 'sin', 'cos', 'tan',
  // 运算
  '求和', '求积', '开根号', '根号', '立方', '平方', '指数', '对数',
];

// ================================================================
// CrossFusionEngine
// ================================================================

export class CrossFusionEngine {
  private vadConfig: VADConfig;
  private pendingSegments: Map<string, Partial<FusionSegment>> = new Map();
  private completedSegments: FusionSegment[] = [];

  private visionResults: VisionResult[] = [];
  private audioResults: AudioResult[] = [];

  private onSegmentComplete: (segment: FusionSegment) => void;
  private fusionWindowMs: number;
  private segmentCounter = 0;

  // VAD 状态
  private isSpeaking = false;
  private speechStartTime: number | null = null;
  private lastSpeechTime: number | null = null;

  constructor(
    onSegmentComplete: (segment: FusionSegment) => void,
    vadConfig?: Partial<VADConfig>,
    fusionWindowMs?: number,
  ) {
    this.onSegmentComplete = onSegmentComplete;
    this.vadConfig = { ...DEFAULT_VAD_CONFIG, ...vadConfig };
    this.fusionWindowMs = fusionWindowMs ?? DEFAULT_FUSION_WINDOW_MS;
  }

  // ================================================================
  // VAD（Voice Activity Detection）
  // ================================================================

  /**
   * 简易 VAD：基于音频 RMS 能量检测语音活动
   * 返回 true 表示检测到语音活动
   */
  detectVoiceActivity(audioBuffer: ArrayBuffer): boolean {
    const samples = new Float32Array(audioBuffer);
    if (samples.length === 0) return false;

    // 计算 RMS 能量
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
    }
    const rmsEnergy = Math.sqrt(sumSquares / samples.length);

    const now = Date.now();
    const hasVoice = rmsEnergy >= this.vadConfig.energyThreshold;

    if (hasVoice) {
      if (!this.isSpeaking) {
        // 语音开始
        this.isSpeaking = true;
        this.speechStartTime = now;
        console.log(`[CrossFusion] Speech started (energy=${rmsEnergy.toFixed(4)})`);
      }
      this.lastSpeechTime = now;
    } else if (this.isSpeaking && this.lastSpeechTime !== null) {
      // 静音中，检查是否超过 silenceDuration
      const silenceElapsed = now - this.lastSpeechTime;
      if (silenceElapsed >= this.vadConfig.silenceDuration) {
        // 语音段落结束
        const duration = now - (this.speechStartTime ?? now);
        this.isSpeaking = false;

        if (duration >= this.vadConfig.minSpeechDuration) {
          console.log(`[CrossFusion] Speech segment ended (duration=${duration}ms)`);
          this.completeSpeechSegment(this.speechStartTime ?? now, now);
        } else {
          console.log(`[CrossFusion] Speech too short (${duration}ms < ${this.vadConfig.minSpeechDuration}ms), ignoring`);
        }

        this.speechStartTime = null;
        this.lastSpeechTime = null;
      }
    }

    return hasVoice;
  }

  /**
   * VAD 触发时调用：请求视觉抓取
   * 返回一个事件标识，供外部触发截图
   */
  requestVisionCapture(): VADTriggerEvent {
    const event: VADTriggerEvent = {
      type: 'vad_triggered',
      timestamp: Date.now(),
    };
    captureEventBus.emit('fusion:vad_triggered', event);
    return event;
  }

  // ================================================================
  // 接收结果
  // ================================================================

  /**
   * 接收视觉提取结果
   */
  addVisionResult(
    timestamp: number,
    text: string,
    confidence: number,
    structured?: Record<string, unknown>,
  ): void {
    this.visionResults.push({ timestamp, text, confidence, structured });
    this.tryFusePending();
  }

  /**
   * 接收 ASR 转写结果
   */
  addAudioResult(
    timestamp: number,
    text: string,
    confidence: number,
    segments?: Array<{ start: number; end: number; text: string }>,
  ): void {
    this.audioResults.push({ timestamp, text, confidence, segments });
    this.tryFusePending();
  }

  // ================================================================
  // 融合
  // ================================================================

  /**
   * 尝试融合时间窗口内的视觉和音频结果
   * 基于时间戳对齐（默认 ±5s 窗口）
   */
  fuseByTimeWindow(windowMs?: number): FusionSegment[] {
    const window = windowMs ?? this.fusionWindowMs;
    const now = Date.now();
    const windowStart = now - window;
    const windowEnd = now + window;

    // 收集窗口内的结果
    const visionInWindow = this.visionResults.filter(
      r => r.timestamp >= windowStart && r.timestamp <= windowEnd,
    );
    const audioInWindow = this.audioResults.filter(
      r => r.timestamp >= windowStart && r.timestamp <= windowEnd,
    );

    if (visionInWindow.length === 0 && audioInWindow.length === 0) {
      return [];
    }

    // 构建融合片段
    const allTimestamps = [
      ...visionInWindow.map(r => r.timestamp),
      ...audioInWindow.map(r => r.timestamp),
    ];
    const startTime = Math.min(...allTimestamps);
    const endTime = Math.max(...allTimestamps);

    // 合并视觉文本
    const visionText = visionInWindow
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(r => r.text)
      .join('\n');

    // 合并音频文本
    const audioText = audioInWindow
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(r => r.text)
      .join('\n');

    // 文本去重
    const dedup = this.deduplicateText(visionText, audioText);

    // 公式检测与校正
    const visionFormulas = this.extractFormulas(visionInWindow);
    const correctedFormulas = visionFormulas.length > 0
      ? this.crossValidateFormulas(visionFormulas, audioText)
      : [];

    const hasFormula = correctedFormulas.length > 0 || visionFormulas.length > 0;

    // 融合文本
    let mergedText: string;
    if (dedup.isDuplicate) {
      // 重复时保留置信度更高的版本
      const visionConfAvg = visionInWindow.length > 0
        ? visionInWindow.reduce((s, r) => s + r.confidence, 0) / visionInWindow.length
        : 0;
      const audioConfAvg = audioInWindow.length > 0
        ? audioInWindow.reduce((s, r) => s + r.confidence, 0) / audioInWindow.length
        : 0;
      mergedText = visionConfAvg >= audioConfAvg ? visionText : audioText;
    } else {
      mergedText = dedup.merged;
    }

    // 如果有校正后的公式，追加到合并文本
    if (correctedFormulas.length > 0) {
      mergedText += '\n\n公式校正结果：\n' + correctedFormulas.join('\n');
    }

    // 综合置信度
    const allConfidences = [
      ...visionInWindow.map(r => r.confidence),
      ...audioInWindow.map(r => r.confidence),
    ];
    const confidence = allConfidences.length > 0
      ? allConfidences.reduce((s, c) => s + c, 0) / allConfidences.length
      : 0;

    // 来源
    const sources: ('vision' | 'audio')[] = [];
    if (visionInWindow.length > 0) sources.push('vision');
    if (audioInWindow.length > 0) sources.push('audio');

    const segment: FusionSegment = {
      id: `cf-${++this.segmentCounter}-${Date.now()}`,
      startTime,
      endTime,
      visionText,
      audioText,
      mergedText,
      confidence: Math.round(confidence * 1000) / 1000,
      hasFormula,
      sources,
    };

    this.completedSegments.push(segment);
    this.onSegmentComplete(segment);

    // 清理已融合的结果
    this.visionResults = this.visionResults.filter(
      r => r.timestamp < windowStart || r.timestamp > windowEnd,
    );
    this.audioResults = this.audioResults.filter(
      r => r.timestamp < windowStart || r.timestamp > windowEnd,
    );

    return [segment];
  }

  // ================================================================
  // 查询 & 状态管理
  // ================================================================

  /**
   * 获取已完成的融合片段
   */
  getCompletedSegments(): FusionSegment[] {
    return [...this.completedSegments];
  }

  /**
   * 清空状态
   */
  reset(): void {
    this.pendingSegments.clear();
    this.completedSegments = [];
    this.visionResults = [];
    this.audioResults = [];
    this.segmentCounter = 0;
    this.isSpeaking = false;
    this.speechStartTime = null;
    this.lastSpeechTime = null;
  }

  // ================================================================
  // 私有方法
  // ================================================================

  /**
   * 语音段落结束时自动尝试融合
   */
  private completeSpeechSegment(startTime: number, endTime: number): void {
    // 查找时间范围内的视觉和音频结果
    const visionInSegment = this.visionResults.filter(
      r => r.timestamp >= startTime - this.fusionWindowMs
        && r.timestamp <= endTime + this.fusionWindowMs,
    );
    const audioInSegment = this.audioResults.filter(
      r => r.timestamp >= startTime - this.fusionWindowMs
        && r.timestamp <= endTime + this.fusionWindowMs,
    );

    if (visionInSegment.length > 0 || audioInSegment.length > 0) {
      // 触发现有结果的融合
      this.fuseByTimeWindow(this.fusionWindowMs);
    }
  }

  /**
   * 尝试自动融合待处理的结果
   * 当视觉和音频结果在时间窗口内匹配时自动触发
   */
  private tryFusePending(): void {
    if (this.visionResults.length === 0 || this.audioResults.length === 0) {
      return;
    }

    // 检查是否有在时间窗口内匹配的视觉和音频结果
    for (const vision of this.visionResults) {
      for (const audio of this.audioResults) {
        const timeDiff = Math.abs(vision.timestamp - audio.timestamp);
        if (timeDiff <= this.fusionWindowMs) {
          // 有匹配的结果，触发融合
          this.fuseByTimeWindow(this.fusionWindowMs);
          return;
        }
      }
    }
  }

  /**
   * 文本去重：ASR 和视觉提取的相似文本合并
   * Jaccard 相似度 > 0.75 → 视为重复，保留置信度更高的版本
   */
  private deduplicateText(
    visionText: string,
    audioText: string,
  ): { merged: string; isDuplicate: boolean } {
    if (!visionText && !audioText) {
      return { merged: '', isDuplicate: false };
    }
    if (!visionText) {
      return { merged: audioText, isDuplicate: false };
    }
    if (!audioText) {
      return { merged: visionText, isDuplicate: false };
    }

    const similarity = jaccardSimilarity(visionText, audioText);

    if (similarity > DEDUP_SIMILARITY_THRESHOLD) {
      // 高度相似，标记为重复，由调用方决定保留哪个版本
      return { merged: visionText, isDuplicate: true };
    }

    // 不重复，合并文本
    return {
      merged: `${visionText}\n${audioText}`,
      isDuplicate: false,
    };
  }

  /**
   * 从视觉结果中提取公式
   */
  private extractFormulas(visionResults: VisionResult[]): string[] {
    const formulas: string[] = [];
    for (const result of visionResults) {
      if (result.structured) {
        const f = result.structured.formulas;
        if (Array.isArray(f)) {
          formulas.push(...f.filter((item): item is string => typeof item === 'string'));
        }
      }
    }
    return formulas;
  }

  /**
   * 公式校正：语音中的数学术语与视觉公式交叉验证
   * 检测语音中的数学术语，与视觉提取的 LaTeX 公式进行匹配验证
   */
  private crossValidateFormulas(
    visionFormulas: string[],
    audioText: string,
  ): string[] {
    if (visionFormulas.length === 0 || !audioText) return [];

    const corrected: string[] = [];

    // 检测语音中提到的数学术语
    const mentionedTerms = MATH_TERMS.filter(term => audioText.includes(term));

    if (mentionedTerms.length === 0) return [];

    // 对每个视觉公式，检查是否与语音中提到的术语相关
    for (const formula of visionFormulas) {
      const formulaLower = formula.toLowerCase();
      const hasMatch = mentionedTerms.some(term => {
        // 检查术语是否出现在公式中，或公式关键词是否在术语中
        return formulaLower.includes(term.toLowerCase())
          || term.toLowerCase().includes(formulaLower);
      });

      if (hasMatch) {
        corrected.push(`[已验证] ${formula}`);
      } else {
        corrected.push(formula);
      }
    }

    return corrected;
  }
}

// ================================================================
// 工具函数
// ================================================================

/**
 * 计算两段文本的 Jaccard 字符集相似度
 */
function jaccardSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const setA = new Set(a);
  const setB = new Set(b);

  let intersectionSize = 0;
  for (const ch of setA) {
    if (setB.has(ch)) intersectionSize++;
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize > 0 ? intersectionSize / unionSize : 0;
}
