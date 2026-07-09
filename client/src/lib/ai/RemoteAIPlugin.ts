import type { AIPlugin, SummarizeResult, FlashcardResult, EvaluateResult, DurationResult,
  SummarizeOptions, FlashcardOptions, EvaluateOptions, DurationOptions, DurationHistoryData } from './types';
import { AIError } from './types';
import { aiClient } from '../http/apiClient';

/**
 * 远程 AI 插件 — 通过 HTTPS 调用 ai-gateway 服务
 *
 * 请求字段做 camelCase → snake_case 转换以匹配后端 Pydantic model；
 * 响应字段从 snake_case 映射回前端 camelCase 类型。
 */
export class RemoteAIPlugin implements AIPlugin {
  private timeout: number;

  constructor(timeout: number = 30000) {
    this.timeout = timeout;
  }

  // ── POST /api/v1/ai/summarize ──────────────────────────────
  async summarizeNote(noteContent: string, options?: SummarizeOptions): Promise<SummarizeResult> {
    try {
      // 构建后端 SummarizeRequest: { text, options: { max_length, style, language } }
      const backendOptions: Record<string, unknown> = {};
      if (options?.maxLength != null) backendOptions.max_length = options.maxLength;
      if (options?.style != null) backendOptions.style = options.style;
      if (options?.language != null) backendOptions.language = options.language;

      const result = await aiClient.post<{
        summary: string; model: string; tokens_used: number; latency_ms: number;
      }>(
        '/api/v1/ai/summarize',
        { text: noteContent, options: backendOptions },
      );

      return {
        summary: result.summary,
        keyPoints: [],
        generatedAt: new Date(),
        model: result.model,
        tokensUsed: result.tokens_used,
        latencyMs: result.latency_ms,
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // ── POST /api/v1/ai/generate-cards ─────────────────────────
  async generateFlashcards(noteContent: string, options?: FlashcardOptions): Promise<FlashcardResult> {
    try {
      // 构建后端 CardGenRequest: { note, options: { max_cards, difficulty, card_type } }
      const backendOptions: Record<string, unknown> = {};
      if (options?.count != null) backendOptions.max_cards = options.count;
      if (options?.difficulty != null) backendOptions.difficulty = options.difficulty;
      if (options?.cardType != null) backendOptions.card_type = options.cardType;

      const result = await aiClient.post<{
        cards: Array<{ front: string; back: string; type: string; confidence: number }>;
        total_extracted: number; model: string; tokens_used: number;
      }>(
        '/api/v1/ai/generate-cards',
        { note: noteContent, options: backendOptions },
      );

      return {
        cards: result.cards.map(c => ({
          front: c.front,
          back: c.back,
          type: c.type,
          confidence: c.confidence,
        })),
        totalExtracted: result.total_extracted,
        generatedAt: new Date(),
        model: result.model,
        tokensUsed: result.tokens_used,
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // ── POST /api/v1/ai/evaluate-explanation ───────────────────
  async evaluateExplanation(concept: string, explanation: string, _options?: EvaluateOptions): Promise<EvaluateResult> {
    try {
      // 构建后端 EvaluateRequest: { concept, explanation }
      const result = await aiClient.post<{
        overall_score: number;
        dimensions: Array<{ dimension: string; score: number; feedback: string }>;
        strengths: string[];
        improvements: string[];
        encouragement: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }>(
        '/api/v1/ai/evaluate-explanation',
        { concept, explanation },
      );

      return {
        overallScore: result.overall_score,
        dimensions: result.dimensions.map(d => ({
          name: d.dimension,
          score: d.score,
          feedback: d.feedback,
        })),
        suggestions: result.improvements,
        strengths: result.strengths,
        weaknesses: [],
        encouragement: result.encouragement,
        generatedAt: new Date(),
        model: result.model,
        tokensUsed: result.tokens_used,
        latencyMs: result.latency_ms,
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // ── POST /api/v1/ai/recommend-duration ─────────────────────
  async recommendDuration(historyData: DurationHistoryData, _options?: DurationOptions): Promise<DurationResult> {
    try {
      // 构建后端 RecommendRequest: { history: [{ duration_minutes, completed, subject, timestamp }] }
      const history = (historyData.sessions || []).map(s => ({
        duration_minutes: s.duration,
        completed: s.completed,
        subject: s.subject || '',
        timestamp: s.date,
      }));

      const result = await aiClient.post<{
        recommended_minutes: number;
        break_minutes: number;
        reason: string;
        source: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }>(
        '/api/v1/ai/recommend-duration',
        { history },
      );

      return {
        recommendedDuration: result.recommended_minutes,
        breakMinutes: result.break_minutes,
        reasoning: result.reason,
        confidence: 'medium',
        source: result.source,
        isLocalFallback: result.source === 'local_rule',
        model: result.model,
        tokensUsed: result.tokens_used,
        latencyMs: result.latency_ms,
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): AIError {
    if (error.message?.includes('timeout') || error.name === 'AbortError') {
      return new AIError('AI 服务响应超时，请稍后重试', 'timeout', true);
    }
    if (error.message?.includes('429')) {
      return new AIError('AI 调用次数已达上限，请稍后重试', 'rate_limit', true);
    }
    if (error.message?.includes('503')) {
      return new AIError('AI 服务暂时不可用', 'service_unavailable', true);
    }
    return new AIError(error.message || 'AI 功能暂不可用', 'service_unavailable', false);
  }
}
