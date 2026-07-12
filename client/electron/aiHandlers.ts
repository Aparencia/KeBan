/**
 * AI 网关 IPC Handler
 *
 * 从 main.ts 拆分而来，包含 6 个 AI 功能的 IPC handler，
 * 均通过 safeHandle 注册以确保幂等性。
 */

import { safeHandle } from './ipcUtils.js';
import { logger } from './logger.js';

// ================================================================
// 常量与辅助函数
// ================================================================

const DEFAULT_GATEWAY_URL = 'http://121.40.24.242:8000';

/** 获取 AI 网关地址，优先读取环境变量 VITE_AI_GATEWAY_URL */
function gatewayUrl(): string {
  return process.env.VITE_AI_GATEWAY_URL || DEFAULT_GATEWAY_URL;
}

/**
 * 通用 POST 请求辅助函数：
 * 1. 将请求体序列化为 JSON
 * 2. 如有 authToken，添加 Authorization header
 * 3. HTTP 失败时抛出包含状态码和详情的错误字符串
 * 4. 返回解析后的 JSON 响应
 */
async function postJson<TReq, TRes>(
  apiPath: string,
  body: TReq,
  authToken?: string,
): Promise<{ data: TRes; requestId: string | undefined }> {
  const url = `${gatewayUrl()}${apiPath}`;
  const startTime = Date.now();
  logger.info(`[AI-Gateway] [${new Date().toISOString()}] POST ${url}`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s timeout

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (networkError: any) {
    const elapsed = Date.now() - startTime;
    if (networkError.name === 'AbortError') {
      logger.error(`[AI-Gateway] [${new Date().toISOString()}] POST ${url} TIMEOUT after ${elapsed}ms`);
      throw new Error('Request timeout after 60s');
    }
    logger.error(`[AI-Gateway] [${new Date().toISOString()}] POST ${url} FAILED after ${elapsed}ms: ${networkError.message}`);
    throw new Error(`Network error: ${networkError.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  const elapsed = Date.now() - startTime;
  const requestId = resp.headers.get('ai-gateway-request-id') ?? undefined;

  if (!resp.ok) {
    const detail = await resp.text().catch(() => 'unknown error');
    logger.error(`[AI-Gateway] [${new Date().toISOString()}] POST ${url} -> ${resp.status} (${elapsed}ms): ${detail}`);
    throw new Error(`HTTP ${resp.status}: ${detail}`);
  }

  logger.info(`[AI-Gateway] [${new Date().toISOString()}] POST ${url} -> ${resp.status} (${elapsed}ms)`);

  try {
    const data = (await resp.json()) as TRes;
    return { data, requestId };
  } catch (e) {
    logger.error(`[AI-Gateway] Response parse error for ${url}: ${e}`);
    throw new Error(`Response parse error: ${e}`);
  }
}

// ================================================================
// 注册所有 AI IPC Handler
// ================================================================

export function registerAIHandlers(): void {
  /**
   * ai_summarize — POST /api/v1/ai/summarize
   * 接收前端 camelCase 参数，转为后端 snake_case 请求体，
   * 再将后端 snake_case 响应转回 camelCase。
   */
  safeHandle(
    'ai_summarize',
    async (
      _event,
      args: {
        text: string;
        maxLength?: number;
        style?: string;
        language?: string;
        authToken?: string;
      },
    ) => {
      // 构建 snake_case 请求体
      const startMs = Date.now();
      logger.info(`[IPC] ai_summarize start, text_length=${args.text.length}`);
      const reqBody = {
        text: args.text,
        options: {
          ...(args.maxLength !== undefined && { max_length: args.maxLength }),
          ...(args.style !== undefined && { style: args.style }),
          ...(args.language !== undefined && { language: args.language }),
        },
      };

      interface SummarizeResp {
        summary: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      const { data: resp, requestId } = await postJson<typeof reqBody, SummarizeResp>(
        '/api/v1/ai/summarize',
        reqBody,
        args.authToken,
      );

      // 转为 camelCase 返回
      logger.info(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
      logger.info(`[IPC] ai_summarize end, model=${resp.model}`);
      return {
        summary: resp.summary,
        model: resp.model,
        tokensUsed: resp.tokens_used,
        latencyMs: resp.latency_ms,
        requestId,
      };
    },
  );

  /**
   * ai_generate_cards — POST /api/v1/ai/generate-cards
   */
  safeHandle(
    'ai_generate_cards',
    async (
      _event,
      args: {
        note: string;
        maxCards?: number;
        difficulty?: string;
        cardType?: string;
        authToken?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[IPC] ai_generate_cards start, note_length=${args.note.length}`);
      const reqBody = {
        note: args.note,
        options: {
          ...(args.maxCards !== undefined && { max_cards: args.maxCards }),
          ...(args.difficulty !== undefined && { difficulty: args.difficulty }),
          ...(args.cardType !== undefined && { card_type: args.cardType }),
        },
      };

      interface CardResp {
        front: string;
        back: string;
        type: string;
        confidence: number;
      }
      interface CardGenResp {
        cards: CardResp[];
        total_extracted: number;
        model: string;
        tokens_used: number;
      }

      const { data: resp, requestId } = await postJson<typeof reqBody, CardGenResp>(
        '/api/v1/ai/generate-cards',
        reqBody,
        args.authToken,
      );

      logger.info(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
      logger.info(`[IPC] ai_generate_cards end, cards_count=${resp.cards.length}`);
      return {
        cards: resp.cards.map((c) => ({
          front: c.front,
          back: c.back,
          type: c.type,
          confidence: c.confidence,
        })),
        totalExtracted: resp.total_extracted,
        model: resp.model,
        tokensUsed: resp.tokens_used,
        requestId,
      };
    },
  );

  /**
   * ai_evaluate — POST /api/v1/ai/evaluate-explanation
   */
  safeHandle(
    'ai_evaluate',
    async (
      _event,
      args: {
        concept: string;
        explanation: string;
        authToken?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[IPC] ai_evaluate start, concept_length=${args.concept.length}`);
      const reqBody = {
        concept: args.concept,
        explanation: args.explanation,
      };

      interface DimensionResp {
        dimension: string;
        score: number;
        feedback: string;
      }
      interface EvaluateResp {
        overall_score: number;
        dimensions: DimensionResp[];
        strengths: string[];
        improvements: string[];
        encouragement: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      const { data: resp, requestId } = await postJson<typeof reqBody, EvaluateResp>(
        '/api/v1/ai/evaluate-explanation',
        reqBody,
        args.authToken,
      );

      logger.info(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
      logger.info(`[IPC] ai_evaluate end, overall_score=${resp.overall_score}`);
      return {
        overallScore: resp.overall_score,
        dimensions: resp.dimensions.map((d) => ({
          name: d.dimension, // 后端字段 dimension → 前端 name
          score: d.score,
          feedback: d.feedback,
        })),
        strengths: resp.strengths,
        improvements: resp.improvements,
        encouragement: resp.encouragement,
        model: resp.model,
        tokensUsed: resp.tokens_used,
        latencyMs: resp.latency_ms,
        requestId,
      };
    },
  );

  /**
   * ai_recommend_duration — POST /api/v1/ai/recommend-duration
   */
  safeHandle(
    'ai_recommend_duration',
    async (
      _event,
      args: {
        history: Array<{
          durationMinutes: number;
          completed: boolean;
          subject: string;
          timestamp: string;
        }>;
        authToken?: string;
      },
    ) => {
      // 前端 camelCase → 后端 snake_case
      const startMs = Date.now();
      logger.info(`[IPC] ai_recommend_duration start, sessions_count=${args.history.length}`);
      const reqBody = {
        history: args.history.map((h) => ({
          duration_minutes: h.durationMinutes,
          completed: h.completed,
          subject: h.subject,
          timestamp: h.timestamp,
        })),
      };

      interface RecommendResp {
        recommended_minutes: number;
        break_minutes: number;
        reason: string;
        source: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      const { data: resp, requestId } = await postJson<typeof reqBody, RecommendResp>(
        '/api/v1/ai/recommend-duration',
        reqBody,
        args.authToken,
      );

      logger.info(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
      logger.info(`[IPC] ai_recommend_duration end, recommended_minutes=${resp.recommended_minutes}`);
      return {
        recommendedMinutes: resp.recommended_minutes,
        breakMinutes: resp.break_minutes,
        reason: resp.reason,
        source: resp.source,
        isLocalFallback: resp.source === 'local_rule',
        model: resp.model,
        tokensUsed: resp.tokens_used,
        latencyMs: resp.latency_ms,
        requestId,
      };
    },
  );

  /**
   * ai_feynman_question — POST /api/v1/ai/feynman-question
   */
  safeHandle(
    'ai_feynman_question',
    async (
      _event,
      args: {
        concept: string;
        explanation: string;
        authToken?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[IPC] ai_feynman_question start, concept_length=${args.concept.length}`);
      const reqBody = {
        concept: args.concept,
        explanation: args.explanation,
      };

      interface FeynmanQuestionResp {
        questions: Array<{ question: string; focus: string }>;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      const { data: resp, requestId } = await postJson<typeof reqBody, FeynmanQuestionResp>(
        '/api/v1/ai/feynman-question',
        reqBody,
        args.authToken,
      );

      logger.info(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
      logger.info(`[IPC] ai_feynman_question end, question_count=${resp.questions.length}`);
      return {
        questions: resp.questions.map((q) => ({
          question: q.question,
          focus: q.focus,
        })),
        model: resp.model,
        tokensUsed: resp.tokens_used,
        latencyMs: resp.latency_ms,
        requestId,
      };
    },
  );

  /**
   * ai_feynman_evaluate_answers — POST /api/v1/ai/feynman-evaluate-answers
   */
  safeHandle(
    'ai_feynman_evaluate_answers',
    async (
      _event,
      args: {
        concept: string;
        questions: string[];
        answers: string[];
        authToken?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[IPC] ai_feynman_evaluate_answers start, concept_length=${args.concept.length}`);
      const reqBody = {
        concept: args.concept,
        questions: args.questions,
        answers: args.answers,
      };

      interface FeynmanAnswerEvalResp {
        understanding_score: number;
        feedback: string;
        strong_points: string[];
        weak_points: string[];
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      const { data: resp, requestId } = await postJson<typeof reqBody, FeynmanAnswerEvalResp>(
        '/api/v1/ai/feynman-evaluate-answers',
        reqBody,
        args.authToken,
      );

      logger.info(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
      logger.info(`[IPC] ai_feynman_evaluate_answers end, score=${resp.understanding_score}`);
      return {
        understandingScore: resp.understanding_score,
        feedback: resp.feedback,
        strongPoints: resp.strong_points,
        weakPoints: resp.weak_points,
        model: resp.model,
        tokensUsed: resp.tokens_used,
        latencyMs: resp.latency_ms,
        requestId,
      };
    },
  );

  /**
   * ai_tag_content — POST /api/v1/ai/tag-content
   */
  safeHandle(
    'ai_tag_content',
    async (
      _event,
      args: {
        content: string;
        authToken?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[IPC] ai_tag_content start, content_length=${args.content.length}`);
      const reqBody = { content: args.content };

      interface TagContentResp {
        content_nature: string;
        cognitive_depth: string;
        subject: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      const { data: resp, requestId } = await postJson<typeof reqBody, TagContentResp>(
        '/api/v1/ai/tag-content',
        reqBody,
        args.authToken,
      );

      logger.info(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
      logger.info(`[IPC] ai_tag_content end, nature=${resp.content_nature}`);
      return {
        contentNature: resp.content_nature,
        cognitiveDepth: resp.cognitive_depth,
        subject: resp.subject,
        model: resp.model,
        tokensUsed: resp.tokens_used,
        latencyMs: resp.latency_ms,
        requestId,
      };
    },
  );

  /**
   * ai_sort_inspiration — POST /api/v1/ai/sort-inspiration
   */
  safeHandle(
    'ai_sort_inspiration',
    async (
      _event,
      args: {
        content: string;
        existingTags?: Record<string, string>;
        authToken?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[IPC] ai_sort_inspiration start, content_length=${args.content.length}`);
      const reqBody = {
        content: args.content,
        existing_tags: args.existingTags,
      };

      interface SortSuggestionResp {
        type: string;
        reason: string;
        confidence: number;
      }
      interface SortInspirationResp {
        suggestions: SortSuggestionResp[];
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      const { data: resp, requestId } = await postJson<typeof reqBody, SortInspirationResp>(
        '/api/v1/ai/sort-inspiration',
        reqBody,
        args.authToken,
      );

      logger.info(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
      logger.info(`[IPC] ai_sort_inspiration end, suggestions_count=${resp.suggestions.length}`);
      return {
        suggestions: resp.suggestions.map((s) => ({
          type: s.type,
          reason: s.reason,
          confidence: s.confidence,
        })),
        model: resp.model,
        tokensUsed: resp.tokens_used,
        latencyMs: resp.latency_ms,
        requestId,
      };
    },
  );
}
