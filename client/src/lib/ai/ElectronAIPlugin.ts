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
  OptimizeCardResult,
  FeynmanQuestionResult,
  FeynmanAnswerEvalResult,
  TagContentResult,
  SortResult,
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

  /**
   * 离线前置检查
   */
  private checkOnline() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new AIError('当前处于离线状态，无法使用 AI 功能', 'offline', false);
    }
  }

  // ── invoke('ai_summarize') ──────────────────────────────────
  async summarizeNote(noteContent: string, options?: SummarizeOptions): Promise<SummarizeResult> {
    this.checkOnline();
    try {
      const ipcStart = performance.now();
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

      return {
        summary: result.summary,
        keyPoints: [],
        generatedAt: new Date(),
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_generate_cards') ─────────────────────────────
  async generateFlashcards(noteContent: string, options?: FlashcardOptions): Promise<FlashcardResult> {
    this.checkOnline();
    try {
      const ipcStart = performance.now();
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
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_evaluate') ───────────────────────────────────
  async evaluateExplanation(
    concept: string,
    explanation: string,
    _options?: EvaluateOptions,
  ): Promise<EvaluateResult> {
    this.checkOnline();
    try {
      const ipcStart = performance.now();
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
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_recommend_duration') ─────────────────────────
  async recommendDuration(
    historyData: DurationHistoryData,
    _options?: DurationOptions,
  ): Promise<DurationResult> {
    this.checkOnline();
    try {
      // 将前端 session 数据映射为 FocusSessionInput（camelCase）
      const history = (historyData.sessions || []).map(s => ({
        durationMinutes: s.duration,
        completed: s.completed,
        subject: s.subject || '',
        timestamp: s.date,
      }));

      const ipcStart = performance.now();
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
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_optimize_card') ──────────────────────────────
  async optimizeCard(front: string, back: string): Promise<OptimizeCardResult> {
    this.checkOnline();
    try {
      const ipcStart = performance.now();
      const result = await window.electronAPI!.invoke('ai_optimize_card', {
        front,
        back,
        authToken: this.authToken,
      }) as {
        suggestedFront: string;
        suggestedBack: string;
        improvements: string[];
        model: string;
        tokensUsed: number;
        latencyMs: number;
        requestId?: string;
      };
      const ipcElapsed = Math.round(performance.now() - ipcStart);

      return {
        suggestedFront: result.suggestedFront,
        suggestedBack: result.suggestedBack,
        improvements: result.improvements,
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_feynman_question') ──────────────────────────
  async generateFeynmanQuestions(concept: string, explanation: string): Promise<FeynmanQuestionResult> {
    this.checkOnline();
    try {
      const ipcStart = performance.now();
      const result = await window.electronAPI!.invoke('ai_feynman_question', {
        concept,
        explanation,
        authToken: this.authToken,
      }) as {
        questions: Array<{ question: string; focus: string }>;
        model: string;
        tokensUsed: number;
        latencyMs: number;
        requestId?: string;
      };
      const ipcElapsed = Math.round(performance.now() - ipcStart);

      return {
        questions: result.questions.map(q => ({
          question: q.question,
          focus: q.focus,
        })),
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_feynman_evaluate_answers') ────────────────────
  async evaluateFeynmanAnswers(
    concept: string,
    questions: string[],
    answers: string[],
  ): Promise<FeynmanAnswerEvalResult> {
    this.checkOnline();
    try {
      const ipcStart = performance.now();
      const result = await window.electronAPI!.invoke('ai_feynman_evaluate_answers', {
        concept,
        questions,
        answers,
        authToken: this.authToken,
      }) as {
        understandingScore: number;
        feedback: string;
        strongPoints: string[];
        weakPoints: string[];
        model: string;
        tokensUsed: number;
        latencyMs: number;
        requestId?: string;
      };
      const ipcElapsed = Math.round(performance.now() - ipcStart);

      return {
        understandingScore: result.understandingScore,
        feedback: result.feedback,
        strongPoints: result.strongPoints,
        weakPoints: result.weakPoints,
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_tag_content') ─────────────────────────────────
  async tagContent(content: string): Promise<TagContentResult> {
    this.checkOnline();
    try {
      const ipcStart = performance.now();
      const result = await window.electronAPI!.invoke('ai_tag_content', {
        content,
        authToken: this.authToken,
      }) as {
        contentNature: string;
        cognitiveDepth: string;
        subject: string;
        model: string;
        tokensUsed: number;
        latencyMs: number;
        requestId?: string;
      };

      return {
        contentNature: result.contentNature as TagContentResult['contentNature'],
        cognitiveDepth: result.cognitiveDepth as TagContentResult['cognitiveDepth'],
        subject: result.subject,
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_sort_inspiration') ─────────────────────────────
  async sortInspiration(content: string, existingTags?: Record<string, string>): Promise<SortResult> {
    this.checkOnline();
    try {
      const ipcStart = performance.now();
      const result = await window.electronAPI!.invoke('ai_sort_inspiration', {
        content,
        existingTags,
        authToken: this.authToken,
      }) as {
        suggestions: Array<{ type: string; reason: string; confidence: number }>;
        model: string;
        tokensUsed: number;
        latencyMs: number;
        requestId?: string;
      };

      return {
        suggestions: result.suggestions.map(s => ({
          type: s.type as SortResult['suggestions'][0]['type'],
          reason: s.reason,
          confidence: s.confidence,
        })),
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): AIError {
    if (error instanceof AIError) return error;

    const msg = error instanceof Error ? error.message : String(error);

    // 离线检查（IPC 调用时网络断开）
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return new AIError('当前处于离线状态', 'offline', false);
    }
    if (msg.includes('Connection refused') || msg.includes('connection refused')
        || msg.includes('os error 10061') || msg.includes('os error 111')) {
      return new AIError(
        'AI 服务未启动，请确保 ai-gateway 正在运行',
        'service_unavailable', true
      );
    }
    if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('ETIMEDOUT')) {
      return new AIError('AI 服务响应超时，请稍后重试', 'timeout', true);
    }
    if (msg.includes('429')) {
      return new AIError('AI 调用次数已达上限，请稍后重试', 'rate_limit', true);
    }
    if (msg.includes('503')) {
      return new AIError('AI 服务暂时不可用', 'service_unavailable', true);
    }
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('ECONNREFUSED')) {
      return new AIError('AI 服务不可用，请检查网络连接', 'service_unavailable', true);
    }
    return new AIError(msg || 'AI 功能暂不可用', 'service_unavailable', false);
  }
}
