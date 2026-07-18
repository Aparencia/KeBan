/**
 * 苏格拉底追问功能 Handler
 *
 * 处理 ai_socratic / ai_socratic_evaluate / ai_socratic_deepening IPC 请求，
 * 调用 AI 网关实现苏格拉底式追问、评估与深化。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, gatewayUrl, type AIFeatureDef } from '../utils.js';

// ================================================================
// 公共类型
// ================================================================

interface BackendHistoryItem {
  role: 'tutor' | 'learner';
  content: string;
}

// ================================================================
// IPC Handler
// ================================================================

/**
 * 注册苏格拉底相关的全部 IPC handler
 */
function register(): void {
  /**
   * ai_socratic — POST /api/v1/ai/socratic
   */
  safeHandle(
    'ai_socratic',
    async (
      _event,
      args: {
        topic: string;
        history?: BackendHistoryItem[] | null;
        authToken?: string;
        userApiKey?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[AI] [socratic] IPC received: topic_length=${args.topic.length}, history=${args.history?.length ?? 0}, hasAuth=${!!args.authToken}`);
      logger.debug(`[AI] [socratic] Topic preview: ${args.topic.slice(0, 80)}`);

      const reqBody = {
        topic: args.topic,
        history: args.history ?? null,
      };

      logger.info(`[AI] [socratic] Target: ${gatewayUrl()}/api/v1/ai/socratic`);

      interface SocraticResp {
        question: string;
        hint: string;
        thinking_direction: string;
        depth_level: number;
        turn_count: number;
        status: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      try {
        const { data: resp, requestId } = await postJson<typeof reqBody, SocraticResp>(
          '/api/v1/ai/socratic',
          reqBody,
          args.authToken,
          args.userApiKey,
          60000,
        );

        const elapsed = Date.now() - startMs;
        logger.info(`[AI] [socratic] ✔ Success: depth=${resp.depth_level}, turn=${resp.turn_count}, model=${resp.model}, tokens=${resp.tokens_used}, total=${elapsed}ms, reqId=${requestId ?? 'N/A'}`);
        return {
          question: resp.question,
          hint: resp.hint,
          thinkingDirection: resp.thinking_direction,
          depthLevel: resp.depth_level,
          turnCount: resp.turn_count,
          status: resp.status,
          model: resp.model,
          tokensUsed: resp.tokens_used,
          latencyMs: resp.latency_ms,
          requestId,
        };
      } catch (err) {
        const elapsed = Date.now() - startMs;
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[AI] [socratic] ✖ Failed after ${elapsed}ms: ${error.message}`);
        if (error.cause) logger.error(`[AI] [socratic] Error cause: ${error.cause}`);
        throw error;
      }
    },
  );

  /**
   * ai_socratic_evaluate — POST /api/v1/ai/socratic/evaluate
   */
  safeHandle(
    'ai_socratic_evaluate',
    async (
      _event,
      args: {
        topic: string;
        question: string;
        answer: string;
        history?: BackendHistoryItem[];
        authToken?: string;
        userApiKey?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[AI] [socratic-eval] IPC received: topic_length=${args.topic.length}, question_length=${args.question.length}, answer_length=${args.answer.length}, history=${args.history?.length ?? 0}, hasAuth=${!!args.authToken}`);
      logger.debug(`[AI] [socratic-eval] Topic: ${args.topic.slice(0, 60)}, Q: ${args.question.slice(0, 60)}`);

      const reqBody = {
        topic: args.topic,
        question: args.question,
        answer: args.answer,
        history: args.history ?? [],
      };

      logger.info(`[AI] [socratic-eval] Target: ${gatewayUrl()}/api/v1/ai/socratic/evaluate`);

      interface SocraticEvaluateResp {
        dimensions: { accuracy: number; completeness: number; logic: number; expression: number };
        feedback: string;
        encouragement: string;
        status: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      try {
        const { data: resp, requestId } = await postJson<typeof reqBody, SocraticEvaluateResp>(
          '/api/v1/ai/socratic/evaluate',
          reqBody,
          args.authToken,
          args.userApiKey,
          60000,
        );

        const elapsed = Date.now() - startMs;
        logger.info(`[AI] [socratic-eval] ✔ Success: accuracy=${resp.dimensions.accuracy}, completeness=${resp.dimensions.completeness}, model=${resp.model}, tokens=${resp.tokens_used}, total=${elapsed}ms, reqId=${requestId ?? 'N/A'}`);
        return {
          dimensions: resp.dimensions,
          feedback: resp.feedback,
          encouragement: resp.encouragement,
          status: resp.status,
          model: resp.model,
          tokensUsed: resp.tokens_used,
          latencyMs: resp.latency_ms,
          requestId,
        };
      } catch (err) {
        const elapsed = Date.now() - startMs;
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[AI] [socratic-eval] ✖ Failed after ${elapsed}ms: ${error.message}`);
        if (error.cause) logger.error(`[AI] [socratic-eval] Error cause: ${error.cause}`);
        throw error;
      }
    },
  );

  /**
   * ai_socratic_deepening — POST /api/v1/ai/socratic/deepening
   */
  safeHandle(
    'ai_socratic_deepening',
    async (
      _event,
      args: {
        topic: string;
        dialogueSummary: string;
        history?: BackendHistoryItem[];
        authToken?: string;
        userApiKey?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[AI] [socratic-deep] IPC received: topic_length=${args.topic.length}, summary_length=${args.dialogueSummary.length}, history=${args.history?.length ?? 0}, hasAuth=${!!args.authToken}`);
      logger.debug(`[AI] [socratic-deep] Topic: ${args.topic.slice(0, 60)}, Summary preview: ${args.dialogueSummary.slice(0, 80)}`);

      // 前端 camelCase dialogueSummary → 后端 snake_case dialogue_summary
      const reqBody = {
        topic: args.topic,
        dialogue_summary: args.dialogueSummary,
        history: args.history ?? [],
      };

      logger.info(`[AI] [socratic-deep] Target: ${gatewayUrl()}/api/v1/ai/socratic/deepening`);

      interface AngleResp {
        key: string;
        label: string;
        question: string;
      }
      interface SocraticDeepeningResp {
        angles: AngleResp[];
        status: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      try {
        const { data: resp, requestId } = await postJson<typeof reqBody, SocraticDeepeningResp>(
          '/api/v1/ai/socratic/deepening',
          reqBody,
          args.authToken,
          args.userApiKey,
          60000,
        );

        const elapsed = Date.now() - startMs;
        logger.info(`[AI] [socratic-deep] ✔ Success: angles=${resp.angles.length}, status=${resp.status}, model=${resp.model}, tokens=${resp.tokens_used}, total=${elapsed}ms, reqId=${requestId ?? 'N/A'}`);
        return {
          angles: resp.angles.map((a) => ({
            key: a.key,
            label: a.label,
            question: a.question,
          })),
          status: resp.status,
          model: resp.model,
          tokensUsed: resp.tokens_used,
          latencyMs: resp.latency_ms,
          requestId,
        };
      } catch (err) {
        const elapsed = Date.now() - startMs;
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[AI] [socratic-deep] ✖ Failed after ${elapsed}ms: ${error.message}`);
        if (error.cause) logger.error(`[AI] [socratic-deep] Error cause: ${error.cause}`);
        throw error;
      }
    },
  );
}

// ================================================================
// 功能定义导出
// ================================================================

export const feature: AIFeatureDef = {
  id: 'ai_socratic',
  name: 'AI 苏格拉底追问',
  version: '1.0.0',
  register,
};
