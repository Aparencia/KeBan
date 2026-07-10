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
 * Electron AI 插件 — 通过 Electron IPC 通道调用 ai-gateway
 *
 * 使用 preload.ts 暴露的 electronAPI.invoke 与主进程通信。
 * 主进程通过 Node.js fetch 代理请求到 ai-gateway 服务。
 */
export class ElectronAIPlugin implements AIPlugin {
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
      const ipcStart = performance.now();
      console.log(`[ElectronAI] summarizeNote → IPC ai_summarize, text_length=${noteContent.length}`);
      console.log(`[IPC] ai_summarize start, text_length=${noteContent.length}`);
      const result = await window.electronAPI!.invoke('ai_summarize', {
        text: noteContent,
        maxLength: options?.maxLength ?? null,
        style: options?.style ?? null,
        language: options?.language ?? null,
        authToken: this.authToken,
      }) as {
        summary: string;
        model: string;
        tokensUsed: number;
        latencyMs: number;
        requestId?: string;
      };
      const ipcElapsed = Math.round(performance.now() - ipcStart);
      console.log(`[ElectronAI] summarizeNote ← IPC ai_summarize done in ${ipcElapsed}ms, model=${result.model}, request_id=${result.requestId ?? 'N/A'}`);
      console.log(`[IPC] ai_summarize end, model=${result.model}, request_id=${result.requestId ?? 'N/A'}`);

      return {
        summary: result.summary,
        keyPoints: [],
        generatedAt: new Date(),
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error: any) {
      console.error('[ElectronAI] summarizeNote failed:', error?.message || error);
      console.error('[IPC] ai_summarize error:', error?.message || error);
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_generate_cards') ─────────────────────────────
  async generateFlashcards(noteContent: string, options?: FlashcardOptions): Promise<FlashcardResult> {
    try {
      const ipcStart = performance.now();
      console.log(`[ElectronAI] generateFlashcards → IPC ai_generate_cards, note_length=${noteContent.length}`);
      console.log(`[IPC] ai_generate_cards start, note_length=${noteContent.length}`);
      const result = await window.electronAPI!.invoke('ai_generate_cards', {
        note: noteContent,
        maxCards: options?.count ?? null,
        difficulty: options?.difficulty ?? null,
        cardType: options?.cardType ?? null,
        authToken: this.authToken,
      }) as {
        cards: Array<{ front: string; back: string; type: string; confidence: number }>;
        totalExtracted: number;
        model: string;
        tokensUsed: number;
        requestId?: string;
      };
      const ipcElapsed = Math.round(performance.now() - ipcStart);
      console.log(`[ElectronAI] generateFlashcards ← IPC ai_generate_cards done in ${ipcElapsed}ms, cards_count=${result.cards.length}, request_id=${result.requestId ?? 'N/A'}`);
      console.log(`[IPC] ai_generate_cards end, cards_count=${result.cards.length}, request_id=${result.requestId ?? 'N/A'}`);

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
      console.error('[ElectronAI] generateFlashcards failed:', error?.message || error);
      console.error('[IPC] ai_generate_cards error:', error?.message || error);
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
      const ipcStart = performance.now();
      console.log(`[ElectronAI] evaluateExplanation → IPC ai_evaluate, concept=${concept}`);
      console.log(`[IPC] ai_evaluate start, concept_length=${concept.length}`);
      const result = await window.electronAPI!.invoke('ai_evaluate', {
        concept,
        explanation,
        authToken: this.authToken,
      }) as {
        overallScore: number;
        dimensions: Array<{ name: string; score: number; feedback: string }>;
        strengths: string[];
        improvements: string[];
        encouragement: string;
        model: string;
        tokensUsed: number;
        latencyMs: number;
        requestId?: string;
      };
      const ipcElapsed = Math.round(performance.now() - ipcStart);
      console.log(`[ElectronAI] evaluateExplanation ← IPC ai_evaluate done in ${ipcElapsed}ms, overall_score=${result.overallScore}, request_id=${result.requestId ?? 'N/A'}`);
      console.log(`[IPC] ai_evaluate end, overall_score=${result.overallScore}, request_id=${result.requestId ?? 'N/A'}`);

      return {
        overallScore: result.overallScore > 10 ? result.overallScore / 10 : result.overallScore,
        dimensions: result.dimensions.map(d => ({
          name: d.name,
          score: d.score,
          feedback: d.feedback,
        })),
        suggestions: result.improvements,
        strengths: result.strengths,
        weaknesses: result.improvements,
        encouragement: result.encouragement,
        generatedAt: new Date(),
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error: any) {
      console.error('[ElectronAI] evaluateExplanation failed:', error?.message || error);
      console.error('[IPC] ai_evaluate error:', error?.message || error);
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_recommend_duration') ─────────────────────────
  async recommendDuration(
    historyData: DurationHistoryData,
    _options?: DurationOptions,
  ): Promise<DurationResult> {
    try {
      // 将前端 session 数据映射为 FocusSessionInput（camelCase）
      const history = (historyData.sessions || []).map(s => ({
        durationMinutes: s.duration,
        completed: s.completed,
        subject: s.subject || '',
        timestamp: s.date,
      }));

      const ipcStart = performance.now();
      console.log(`[ElectronAI] recommendDuration → IPC ai_recommend_duration, sessions_count=${historyData.sessions.length}`);
      console.log(`[IPC] ai_recommend_duration start, sessions_count=${historyData.sessions.length}`);
      const result = await window.electronAPI!.invoke('ai_recommend_duration', {
        history,
        authToken: this.authToken,
      }) as {
        recommendedMinutes: number;
        breakMinutes: number;
        reason: string;
        source: string;
        isLocalFallback: boolean;
        model: string;
        tokensUsed: number;
        latencyMs: number;
        requestId?: string;
      };
      const ipcElapsed = Math.round(performance.now() - ipcStart);
      console.log(`[ElectronAI] recommendDuration ← IPC ai_recommend_duration done in ${ipcElapsed}ms, recommended_minutes=${result.recommendedMinutes}, request_id=${result.requestId ?? 'N/A'}`);
      console.log(`[IPC] ai_recommend_duration end, recommended_minutes=${result.recommendedMinutes}, request_id=${result.requestId ?? 'N/A'}`);

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
      console.error('[ElectronAI] recommendDuration failed:', error?.message || error);
      console.error('[IPC] ai_recommend_duration error:', error?.message || error);
      throw this.handleError(error);
    }
  }

  private handleError(error: any): AIError {
    console.error('[AI] ElectronAIPlugin error:', typeof error === 'string' ? error : error.message);
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
