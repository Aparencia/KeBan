/**
 * 费曼学习法功能 Handler
 *
 * 处理 ai_feynman_question 和 ai_feynman_evaluate_answers IPC 请求，
 * 调用 AI 网关生成追问并评估用户回答。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, gatewayUrl, type AIFeatureDef } from '../utils.js';

// ================================================================
// IPC Handler
// ================================================================

/**
 * 注册费曼学习法相关的所有 IPC handler
 */
function register(): void {
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
        userApiKey?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[AI] [feynman-q] IPC received: concept_length=${args.concept.length}, explanation_length=${args.explanation.length}, hasAuth=${!!args.authToken}`);
      logger.debug(`[AI] [feynman-q] Concept: ${args.concept.slice(0, 60)}`);

      const reqBody = {
        concept: args.concept,
        explanation: args.explanation,
      };

      logger.info(`[AI] [feynman-q] Target: ${gatewayUrl()}/api/v1/ai/feynman-question`);

      interface FeynmanQuestionResp {
        questions: Array<{ question: string; focus: string }>;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      try {
        const { data: resp, requestId } = await postJson<typeof reqBody, FeynmanQuestionResp>(
          '/api/v1/ai/feynman-question',
          reqBody,
          args.authToken,
          args.userApiKey,
          40000,
        );

        const elapsed = Date.now() - startMs;
        logger.info(`[AI] [feynman-q] ✔ Success: questions=${resp.questions.length}, model=${resp.model}, tokens=${resp.tokens_used}, total=${elapsed}ms, reqId=${requestId ?? 'N/A'}`);
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
      } catch (err) {
        const elapsed = Date.now() - startMs;
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[AI] [feynman-q] ✖ Failed after ${elapsed}ms: ${error.message}`);
        if (error.cause) logger.error(`[AI] [feynman-q] Error cause: ${error.cause}`);
        throw error;
      }
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
        userApiKey?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[AI] [feynman-eval] IPC received: concept_length=${args.concept.length}, questions=${args.questions.length}, answers=${args.answers.length}, hasAuth=${!!args.authToken}`);
      logger.debug(`[AI] [feynman-eval] Concept: ${args.concept.slice(0, 60)}, Q count=${args.questions.length}`);

      const reqBody = {
        concept: args.concept,
        questions: args.questions,
        answers: args.answers,
      };

      logger.info(`[AI] [feynman-eval] Target: ${gatewayUrl()}/api/v1/ai/feynman-evaluate-answers`);

      interface FeynmanAnswerEvalResp {
        understanding_score: number;
        feedback: string;
        strong_points: string[];
        weak_points: string[];
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      try {
        const { data: resp, requestId } = await postJson<typeof reqBody, FeynmanAnswerEvalResp>(
          '/api/v1/ai/feynman-evaluate-answers',
          reqBody,
          args.authToken,
          args.userApiKey,
          40000,
        );

        const elapsed = Date.now() - startMs;
        logger.info(`[AI] [feynman-eval] ✔ Success: score=${resp.understanding_score}, strong=${resp.strong_points.length}, weak=${resp.weak_points.length}, model=${resp.model}, total=${elapsed}ms, reqId=${requestId ?? 'N/A'}`);
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
      } catch (err) {
        const elapsed = Date.now() - startMs;
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[AI] [feynman-eval] ✖ Failed after ${elapsed}ms: ${error.message}`);
        if (error.cause) logger.error(`[AI] [feynman-eval] Error cause: ${error.cause}`);
        throw error;
      }
    },
  );
}

// ================================================================
// 功能定义导出
// ================================================================

export const feature: AIFeatureDef = {
  id: 'ai_feynman',
  name: '浮出水面',
  version: '1.0.0',
  register,
};
