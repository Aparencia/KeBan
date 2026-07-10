/**
 * 增量笔记生成器
 * 将融合后的内容自动格式化为 TipTap 节点并插入编辑器
 *
 * 核心能力：
 * 1. FusionSegment → TipTap JSON 节点转换
 * 2. 基于文本指纹的去重（30s 滑动窗口）
 * 3. 自动插入 / 手动暂存双模式
 * 4. 时间戳标记 + 公式提取
 */

import type { FusionSegment } from './crossFusion';

// ================================================================
// 类型定义
// ================================================================

/** NoteGenerator 配置 */
export interface NoteGeneratorConfig {
  /** 是否自动插入（false 时仅暂存待手动插入） */
  autoInsert: boolean;
  /** 最大缓存片段数，默认 100 */
  maxSegments: number;
  /** 去重时间窗口（ms），默认 30000 */
  deduplicateWindow: number;
}

/** 已插入的片段记录 */
export interface InsertedSegment extends FusionSegment {
  /** 插入时间戳 */
  insertedAt: number;
  /** TipTap 节点 ID（可选） */
  nodeId?: string;
}

/** 插入命令，供编辑器执行 */
export interface NoteInsertCommand {
  /** TipTap JSON 内容节点 */
  content: TipTapNode[];
  /** 插入位置 */
  position: 'end';
}

/** TipTap JSON 节点（简化类型，避免使用 any） */
interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNodeContent[];
  marks?: TipTapMark[];
}

/** TipTap 节点内容 */
interface TipTapNodeContent {
  type: string;
  text?: string;
  marks?: TipTapMark[];
}

/** TipTap 文本标记 */
interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

/** addSegment 返回结果 */
export interface AddSegmentResult {
  shouldInsert: boolean;
  reason: string;
}

// ================================================================
// 常量
// ================================================================

const DEFAULT_CONFIG: NoteGeneratorConfig = {
  autoInsert: true,
  maxSegments: 100,
  deduplicateWindow: 30_000,
};

/** 文本指纹取前 N 字符 */
const FINGERPRINT_LENGTH = 50;

/** LaTeX 公式正则：匹配 $...$ 或 $$...$$ 或 \[...\] */
const LATEX_INLINE_RE = /\$\$?([^$]+?)\$\$?/g;
const LATEX_BRACKET_RE = /\\\[([\s\S]+?)\\\]/g;

// ================================================================
// NoteGenerator
// ================================================================

export class NoteGenerator {
  private config: NoteGeneratorConfig;
  private pendingSegments: FusionSegment[] = [];
  private insertedSegments: InsertedSegment[] = [];
  /** 已插入文本指纹 → 插入时间戳 */
  private insertedFingerprints: Map<string, number> = new Map();

  constructor(config: Partial<NoteGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ================================================================
  // 公共 API
  // ================================================================

  /**
   * 接收融合片段，决定是否自动插入
   * 供 captureEventBus 'fusion:segment_complete' 事件消费者调用
   */
  addSegment(segment: FusionSegment): AddSegmentResult {
    // 去重检查
    if (this.isDuplicate(segment.mergedText)) {
      return { shouldInsert: false, reason: 'duplicate' };
    }

    // 手动模式 → 暂存
    if (!this.config.autoInsert) {
      this.pendingSegments.push(segment);
      this.trimPending();
      return { shouldInsert: false, reason: 'pending' };
    }

    // 自动模式 → 标记插入
    return { shouldInsert: true, reason: 'auto' };
  }

  /**
   * 将 FusionSegment 转换为 TipTap JSON 节点数组
   * 包含时间戳标记、主文本、公式（如有）、分隔线
   */
  segmentToTipTapNodes(segment: FusionSegment): TipTapNode[] {
    const nodes: TipTapNode[] = [];

    // 1. 时间戳标记（灰色小字）
    nodes.push({
      type: 'paragraph',
      attrs: { class: 'text-text-tertiary text-c2' },
      content: [
        {
          type: 'text',
          text: `[${formatTimestamp(segment.startTime)}]`,
        },
      ],
    });

    // 2. 主文本内容
    if (segment.mergedText) {
      nodes.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: segment.mergedText },
        ],
      });
    }

    // 3. 公式提取（视觉文本中的 LaTeX）
    if (segment.hasFormula && segment.visionText) {
      const formulas = extractFormulas(segment.visionText);
      for (const formula of formulas) {
        nodes.push({
          type: 'codeBlock',
          attrs: { language: 'latex' },
          content: [
            { type: 'text', text: formula },
          ],
        });
      }
    }

    // 4. 分隔线
    nodes.push({ type: 'horizontalRule' });

    return nodes;
  }

  /**
   * 生成插入命令（供 TipTap editor 执行）
   */
  generateInsertCommand(segment: FusionSegment): NoteInsertCommand {
    return {
      content: this.segmentToTipTapNodes(segment),
      position: 'end',
    };
  }

  /**
   * 确认已插入（编辑器执行插入后回调）
   */
  markInserted(segment: FusionSegment, nodeId?: string): void {
    const fingerprint = this.textFingerprint(segment.mergedText);
    this.insertedFingerprints.set(fingerprint, Date.now());
    this.insertedSegments.push({
      ...segment,
      insertedAt: Date.now(),
      nodeId,
    });

    // 限制已插入记录数
    if (this.insertedSegments.length > this.config.maxSegments) {
      this.insertedSegments.shift();
    }

    // 如果该片段在 pending 中，移除
    this.pendingSegments = this.pendingSegments.filter(s => s.id !== segment.id);
  }

  /**
   * 获取待插入片段（手动模式下使用）
   */
  getPendingSegments(): FusionSegment[] {
    return [...this.pendingSegments];
  }

  /**
   * 获取已插入片段
   */
  getInsertedSegments(): InsertedSegment[] {
    return [...this.insertedSegments];
  }

  /**
   * 清空待插入队列
   */
  clearPending(): void {
    this.pendingSegments = [];
  }

  /**
   * 重置所有状态
   */
  reset(): void {
    this.pendingSegments = [];
    this.insertedSegments = [];
    this.insertedFingerprints.clear();
  }

  /**
   * 更新配置
   */
  updateConfig(patch: Partial<NoteGeneratorConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  /**
   * 获取当前配置（只读快照）
   */
  getConfig(): NoteGeneratorConfig {
    return { ...this.config };
  }

  // ================================================================
  // 私有方法
  // ================================================================

  /**
   * 去重检查：文本指纹是否已存在于滑动窗口内
   */
  private isDuplicate(text: string): boolean {
    const fp = this.textFingerprint(text);
    const insertedAt = this.insertedFingerprints.get(fp);

    if (insertedAt === undefined) return false;

    const elapsed = Date.now() - insertedAt;
    if (elapsed < this.config.deduplicateWindow) {
      return true;
    }

    // 超过窗口，清除旧指纹
    this.insertedFingerprints.delete(fp);
    return false;
  }

  /**
   * 生成文本指纹（前 FINGERPRINT_LENGTH 字符 + 长度）
   */
  private textFingerprint(text: string): string {
    const prefix = text.slice(0, FINGERPRINT_LENGTH);
    return `${prefix}::${text.length}`;
  }

  /**
   * 裁剪待插入队列，保持在 maxSegments 以内
   */
  private trimPending(): void {
    while (this.pendingSegments.length > this.config.maxSegments) {
      this.pendingSegments.shift();
    }
  }
}

// ================================================================
// 工具函数
// ================================================================

/**
 * 格式化时间戳为 HH:MM:SS
 */
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * 从文本中提取 LaTeX 公式
 * 支持 $...$、$$...$$、\[...\] 三种格式
 */
function extractFormulas(text: string): string[] {
  const formulas: string[] = [];
  const seen = new Set<string>();

  // 匹配 $$...$$ 和 $...$
  for (const match of text.matchAll(LATEX_INLINE_RE)) {
    const formula = match[1].trim();
    if (formula && !seen.has(formula)) {
      seen.add(formula);
      formulas.push(formula);
    }
  }

  // 匹配 \[...\]
  for (const match of text.matchAll(LATEX_BRACKET_RE)) {
    const formula = match[1].trim();
    if (formula && !seen.has(formula)) {
      seen.add(formula);
      formulas.push(formula);
    }
  }

  return formulas;
}
