import { invoke } from '@tauri-apps/api/core';
import type {
  AIPlugin,
  SummarizeOptions,
  SummarizeResult,
  FlashcardOptions,
  FlashcardResult,
  EvaluateOptions,
  EvaluateResult,
  DurationOptions,
  DurationHistoryData,
  DurationResult,
} from './types';
import { AIError } from './types';

/**
 * Tauri AI 插件 — 通过 Rust invoke 通道调用 ai-gateway
 *
 * 绕过 WebView 网络限制，直接使用 Tauri 的 reqwest HTTP 客户端。
 * invoke 参数名与 Rust #[tauri::command(rename_all = "camelCase")] 转换后的名称匹配。
 */
export class TauriAIPlugin implements AIPlugin {
  private authToken: string | null = null;

  /**
   * 设置认证 token（每次 AI 调用前可更新）
   */
  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  // ── invoke('ai_summarize') ──────────────────────────────────
  async summarizeNote(noteContent: string, options?: SummarizeOptions): Promise<SummarizeResult> {
    if (!noteContent || noteContent.trim().length < 10) {
      throw new AIError('笔记内容过短（至少 10 个字符），无法生成摘要', 'invalid_response', false);
    }
    try {
      const result = await invoke<{
        summary: string;
        model: string;
        tokensUsed: number;
        latencyMs: number;
      }>('ai_summarize', {
        text: noteContent,
        maxLength: options?.maxLength ?? null,
        style: options?.style ?? null,
        language: options?.language ?? null,
        authToken: this.authToken,
      });

      return {
        summary: result.summary,
        keyPoints: [],
        generatedAt: new Date(),
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_generate_cards') ─────────────────────────────
  async generateFlashcards(noteContent: string, options?: FlashcardOptions): Promise<FlashcardResult> {
    try {
      const result = await invoke<{
        cards: Array<{ front: string; back: string; type: string; confidence: number }>;
        totalExtracted: number;
        model: string;
        tokensUsed: number;
      }>('ai_generate_cards', {
        note: noteContent,
        maxCards: options?.count ?? null,
        difficulty: options?.difficulty ?? null,
        cardType: options?.cardType ?? null,
        authToken: this.authToken,
      });

      return {
        cards: result.cards.map(c => ({
          front: c.front,
          back: c.back,
          type: c.type,
          confidence: c.confidence,
        })),
        totalExtracted: result.totalExtracted,
        generatedAt: new Date(),
        model: result.model,
        tokensUsed: result.tokensUsed,
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_evaluate') ───────────────────────────────────
  async evaluateExplanation(
    concept: string,
    explanation: string,
    _options?: EvaluateOptions,
  ): Promise<EvaluateResult> {
    try {
      const result = await invoke<{
        overallScore: number;
        dimensions: Array<{ name: string; score: number; feedback: string }>;
        strengths: string[];
        improvements: string[];
        encouragement: string;
        model: string;
        tokensUsed: number;
        latencyMs: number;
      }>('ai_evaluate', {
        concept,
        explanation,
        authToken: this.authToken,
      });

      return {
        overallScore: result.overallScore,
        dimensions: result.dimensions.map(d => ({
          name: d.name,
          score: d.score,
          feedback: d.feedback,
        })),
        suggestions: result.improvements,
        strengths: result.strengths,
        weaknesses: [],
        encouragement: result.encouragement,
        generatedAt: new Date(),
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_recommend_duration') ─────────────────────────
  async recommendDuration(
    historyData: DurationHistoryData,
    _options?: DurationOptions,
  ): Promise<DurationResult> {
    try {
      // 将前端 session 数据映射为 Rust FocusSessionInput（camelCase）
      const history = (historyData.sessions || []).map(s => ({
        durationMinutes: s.duration,
        completed: s.completed,
        subject: s.subject || '',
        timestamp: s.date,
      }));

      const result = await invoke<{
        recommendedMinutes: number;
        breakMinutes: number;
        reason: string;
        source: string;
        isLocalFallback: boolean;
        model: string;
        tokensUsed: number;
        latencyMs: number;
      }>('ai_recommend_duration', {
        history,
        authToken: this.authToken,
      });

      return {
        recommendedDuration: result.recommendedMinutes,
        breakMinutes: result.breakMinutes,
        reasoning: result.reason,
        confidence: 'medium',
        source: result.source,
        isLocalFallback: result.isLocalFallback,
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): AIError {
    const msg = typeof error === 'string' ? error : (error.message || String(error));
    if (msg.includes('Connection refused') || msg.includes('connection refused')
        || msg.includes('os error 10061') || msg.includes('os error 111')) {
      return new AIError(
        'AI 服务未启动，请确保 ai-gateway 正在运行',
        'service_unavailable', true
      );
    }
    if (msg.includes('timeout') || msg.includes('Timeout')) {
      return new AIError('AI 服务响应超时，请稍后重试', 'timeout', true);
    }
    if (msg.includes('429')) {
      return new AIError('AI 调用次数已达上限，请稍后重试', 'rate_limit', true);
    }
    if (msg.includes('503')) {
      return new AIError('AI 服务暂时不可用', 'service_unavailable', true);
    }
    return new AIError(msg || 'AI 功能暂不可用', 'service_unavailable', false);
  }
}
