import { invoke } from '@tauri-apps/api/core';
import { LocalDurationRecommender } from './LocalFallback';
import type { DurationHistoryData, DurationOptions, DurationResult,
  SummarizeResult, FlashcardResult, EvaluateResult,
  SummarizeOptions, FlashcardOptions, EvaluateOptions } from './types';

/**
 * AI 插件加载器（单例）
 * 通过 Tauri invoke 调用 Rust 层 AI Gateway 命令，失败时降级到本地规则引擎
 */
class AIPluginLoader {
  private localRecommender: LocalDurationRecommender;

  constructor() {
    this.localRecommender = new LocalDurationRecommender();
  }

  /**
   * 摘要功能 — Rust Tauri command: ai_summarize
   */
  async summarizeNote(content: string, options?: SummarizeOptions): Promise<SummarizeResult> {
    const raw = await invoke<{
      summary: string; model: string; tokensUsed: number; latencyMs: number;
    }>('ai_summarize', {
      text: content,
      maxLength: options?.maxLength ?? null,
      style: options?.style ?? null,
      language: options?.language ?? null,
    });

    return {
      summary: raw.summary,
      keyPoints: [],
      generatedAt: new Date(),
      model: raw.model,
      tokensUsed: raw.tokensUsed,
      latencyMs: raw.latencyMs,
    };
  }

  /**
   * 闪卡生成 — Rust Tauri command: ai_generate_cards
   */
  async generateFlashcards(content: string, options?: FlashcardOptions): Promise<FlashcardResult> {
    const raw = await invoke<{
      cards: Array<{ front: string; back: string; type: string; confidence: number }>;
      totalExtracted: number; model: string; tokensUsed: number;
    }>('ai_generate_cards', {
      note: content,
      maxCards: options?.count ?? null,
      difficulty: options?.difficulty ?? null,
      cardType: options?.cardType ?? null,
    });

    return {
      cards: raw.cards.map(c => ({
        front: c.front,
        back: c.back,
        type: c.type,
        confidence: c.confidence,
      })),
      totalExtracted: raw.totalExtracted,
      generatedAt: new Date(),
      model: raw.model,
      tokensUsed: raw.tokensUsed,
    };
  }

  /**
   * 费曼评估 — Rust Tauri command: ai_evaluate
   */
  async evaluateExplanation(concept: string, explanation: string, _options?: EvaluateOptions): Promise<EvaluateResult> {
    const raw = await invoke<{
      overallScore: number;
      dimensions: Array<{ name: string; score: number; feedback: string }>;
      strengths: string[];
      improvements: string[];
      encouragement: string;
      model: string;
      tokensUsed: number;
      latencyMs: number;
    }>('ai_evaluate', { concept, explanation });

    return {
      overallScore: raw.overallScore,
      dimensions: raw.dimensions,
      suggestions: raw.improvements,
      strengths: raw.strengths,
      weaknesses: [],
      encouragement: raw.encouragement,
      generatedAt: new Date(),
      model: raw.model,
      tokensUsed: raw.tokensUsed,
      latencyMs: raw.latencyMs,
    };
  }

  /**
   * 番茄钟推荐 — 远程优先，失败时自动降级到本地规则引擎
   */
  async recommendDuration(historyData: DurationHistoryData, options?: DurationOptions): Promise<DurationResult> {
    try {
      // 将前端 sessions 数组转为后端 history 格式（snake_case 字段）
      const history = (historyData.sessions || []).map(s => ({
        durationMinutes: s.duration,
        completed: s.completed,
        subject: s.subject || '',
        timestamp: s.date,
      }));

      const raw = await invoke<{
        recommendedMinutes: number;
        breakMinutes: number;
        reason: string;
        source: string;
        isLocalFallback: boolean;
        model: string;
        tokensUsed: number;
        latencyMs: number;
      }>('ai_recommend_duration', { history });

      return {
        recommendedDuration: raw.recommendedMinutes,
        breakMinutes: raw.breakMinutes,
        reasoning: raw.reason,
        confidence: 'medium',
        source: raw.source,
        isLocalFallback: raw.isLocalFallback,
        model: raw.model,
        tokensUsed: raw.tokensUsed,
        latencyMs: raw.latencyMs,
      };
    } catch {
      // 自动降级到本地推荐
      return this.localRecommender.recommend(historyData, options);
    }
  }
}

// 单例
export const aiPluginLoader = new AIPluginLoader();
import { RemoteAIPlugin } from './RemoteAIPlugin';
import { LocalDurationRecommender } from './LocalFallback';
import type { DurationHistoryData, DurationOptions, DurationResult,
  SummarizeResult, FlashcardResult, EvaluateResult,
  SummarizeOptions, FlashcardOptions, EvaluateOptions } from './types';

/**
 * AI 插件加载器（单例）
 * 管理远程 AI 插件和本地降级
 */
class AIPluginLoader {
  private remotePlugin: RemoteAIPlugin | null = null;
  private localRecommender: LocalDurationRecommender;

  constructor() {
    this.localRecommender = new LocalDurationRecommender();
  }

  /**
   * 获取远程 AI 插件实例（懒加载）
   */
  getRemotePlugin(): RemoteAIPlugin {
    if (!this.remotePlugin) {
      this.remotePlugin = new RemoteAIPlugin();
    }
    return this.remotePlugin;
  }

  /**
   * 摘要功能 — 远程调用，失败时返回降级提示
   */
  async summarizeNote(content: string, options?: SummarizeOptions): Promise<SummarizeResult> {
    return this.getRemotePlugin().summarizeNote(content, options);
  }

  /**
   * 闪卡生成 — 远程调用，失败时返回降级提示
   */
  async generateFlashcards(content: string, options?: FlashcardOptions): Promise<FlashcardResult> {
    return this.getRemotePlugin().generateFlashcards(content, options);
  }

  /**
   * 费曼评估 — 远程调用，失败时返回降级提示
   */
  async evaluateExplanation(concept: string, explanation: string, options?: EvaluateOptions): Promise<EvaluateResult> {
    return this.getRemotePlugin().evaluateExplanation(concept, explanation, options);
  }

  /**
   * 番茄钟推荐 — 远程优先，失败时自动降级到本地规则引擎
   */
  async recommendDuration(historyData: DurationHistoryData, options?: DurationOptions): Promise<DurationResult> {
    try {
      return await this.getRemotePlugin().recommendDuration(historyData, options);
    } catch {
      // 自动降级到本地推荐
      return this.localRecommender.recommend(historyData, options);
    }
  }
}

// 单例
export const aiPluginLoader = new AIPluginLoader();
