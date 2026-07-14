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
  AnchorPoint,
  BrainstormIdea,
  ChatMessage,
  SocraticEvaluateResult,
  SocraticDeepeningResult,
  PredictionPrompt,
  RescueContext,
  ResourceLink,
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
        suggestions: Array<{ category: string; reason: string; confidence: number; suggestedAction?: string }>;
        model: string;
        tokensUsed: number;
        latencyMs: number;
        requestId?: string;
      };

      return {
        suggestions: result.suggestions.map(s => ({
          category: s.category as SortResult['suggestions'][0]['category'],
          reason: s.reason,
          confidence: s.confidence,
          suggestedAction: s.suggestedAction,
        })),
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_anchor_point') ─────────────────────────────────
  async generateAnchorPoint(noteId: string, content: string): Promise<{ anchorPoints: AnchorPoint[] }> {
    this.checkOnline();
    try {
      const result = await window.electronAPI!.invoke('ai_anchor_point', {
        content,
        title: '',
        authToken: this.authToken,
      }) as {
        anchorPoints: Array<{ concept: string; association: string; memoryTechnique: string; importance: number }>;
        status: string; model: string; tokensUsed: number; latencyMs: number;
      };

      return {
        anchorPoints: (result.anchorPoints || []).map(ap => ({
          concept: ap.concept,
          importance: ap.importance,
          explanation: ap.association || ap.memoryTechnique || undefined,
          relatedConcepts: ap.memoryTechnique ? [ap.memoryTechnique] : undefined,
        })),
      };
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_socratic') brainstorm ──────────────────────────
  async socraticBrainstorm(topic: string, context?: string): Promise<{ ideas: BrainstormIdea[] }> {
    this.checkOnline();
    try {
      const result = await window.electronAPI!.invoke('ai_socratic', {
        topic,
        history: context ? [{ role: 'learner', content: context }] : null,
        authToken: this.authToken,
      }) as {
        question: string; hint: string; thinkingDirection: string;
        depthLevel: number; turnCount: number;
        status: string; model: string; tokensUsed: number; latencyMs: number;
      };

      return {
        ideas: [
          {
            title: result.question || '思考方向',
            description: result.hint || result.thinkingDirection || '',
            category: result.thinkingDirection || undefined,
            feasibility: 0.7,
            source: 'socratic_brainstorm',
          },
        ],
      };
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_socratic') question ────────────────────────────
  async socraticQuestion(
    conversationId: string,
    topic: string,
    history: ChatMessage[],
  ): Promise<{ question: string; hints: string[] }> {
    this.checkOnline();
    try {
      const backendHistory = history.map(h => ({
        role: h.role === 'assistant' ? 'tutor' : 'learner',
        content: h.content,
      }));

      const result = await window.electronAPI!.invoke('ai_socratic', {
        topic,
        history: backendHistory.length > 0 ? backendHistory : null,
        authToken: this.authToken,
      }) as {
        question: string; hint: string; thinkingDirection: string;
        depthLevel: number; turnCount: number;
        status: string; model: string; tokensUsed: number; latencyMs: number;
      };

      return {
        question: result.question,
        hints: [result.hint, result.thinkingDirection].filter(Boolean),
      };
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_socratic_evaluate') ────────────────────────────
  async socraticEvaluate(
    topic: string,
    question: string,
    answer: string,
    history: ChatMessage[],
  ): Promise<SocraticEvaluateResult> {
    this.checkOnline();
    try {
      const backendHistory = history.map(h => ({
        role: h.role === 'assistant' ? 'tutor' : 'learner',
        content: h.content,
      }));

      const result = await window.electronAPI!.invoke('ai_socratic_evaluate', {
        topic,
        question,
        answer,
        history: backendHistory,
        authToken: this.authToken,
      }) as {
        dimensions: { accuracy: number; completeness: number; logic: number; expression: number };
        feedback: string;
        encouragement: string;
        status: string;
        model: string;
        tokensUsed: number;
        latencyMs: number;
      };

      return {
        dimensions: result.dimensions,
        feedback: result.feedback,
        encouragement: result.encouragement,
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error) {
      throw this.handleError(error, 'socraticEvaluate');
    }
  }

  // ── invoke('ai_socratic_deepening') ───────────────────────────
  async socraticDeepening(
    topic: string,
    dialogueSummary: string,
    history: ChatMessage[],
  ): Promise<SocraticDeepeningResult> {
    this.checkOnline();
    try {
      const backendHistory = history.map(h => ({
        role: h.role === 'assistant' ? 'tutor' : 'learner',
        content: h.content,
      }));

      const result = await window.electronAPI!.invoke('ai_socratic_deepening', {
        topic,
        dialogueSummary,
        history: backendHistory,
        authToken: this.authToken,
      }) as {
        angles: Array<{ key: string; label: string; question: string }>;
        status: string;
        model: string;
        tokensUsed: number;
        latencyMs: number;
      };

      return {
        angles: result.angles,
        status: result.status,
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error) {
      throw this.handleError(error, 'socraticDeepening');
    }
  }

  // ── invoke('ai_predict') ──────────────────────────────────────
  async predictQuestion(noteId: string, content: string): Promise<{ predictions: PredictionPrompt[] }> {
    this.checkOnline();
    try {
      const result = await window.electronAPI!.invoke('ai_predict', {
        content,
        authToken: this.authToken,
      }) as {
        predictions: Array<{ question: string; type: string; reason: string; curiosityScore: number }>;
        status: string; model: string; tokensUsed: number; latencyMs: number;
      };

      return {
        predictions: (result.predictions || []).map(p => ({
          question: p.question,
          expectedAnswer: p.reason || '',
          difficulty: Math.round(p.curiosityScore * 5) as PredictionPrompt['difficulty'],
          relatedConcepts: p.type ? [p.type] : undefined,
        })),
      };
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  // ── invoke('ai_rescue') ───────────────────────────────────────
  async rescue(context: RescueContext): Promise<{ hints: string[]; resources: ResourceLink[]; alternativeApproach?: string }> {
    this.checkOnline();
    try {
      const result = await window.electronAPI!.invoke('ai_rescue', {
        content: context.relatedContent || context.topic,
        stuckDescription: context.stuckPoint || context.topic,
        attemptedMethods: context.attempts?.join('; ') || '',
        authToken: this.authToken,
      }) as {
        rescueLevels: Array<{ level: number; label: string; suggestion: string; hintQuestion: string }>;
        encouragement: string;
        status: string; model: string; tokensUsed: number; latencyMs: number;
      };

      const hints = (result.rescueLevels || []).map(lv => lv.hintQuestion || lv.suggestion);
      const alternativeApproach = (result.rescueLevels || []).find(lv => lv.level === 3)?.suggestion;

      return {
        hints,
        resources: [],
        alternativeApproach,
      };
    } catch (error: unknown) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown, _ctx?: string): AIError {
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
