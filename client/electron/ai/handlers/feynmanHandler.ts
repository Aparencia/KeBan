/**
 * 费曼学习法功能 Handler
 *
 * 处理 ai_feynman_question 和 ai_feynman_evaluate_answers IPC 请求，
 * 调用 AI 网关生成追问并评估用户回答。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, type AIFeatureDef } from '../utils.js';

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
}

// ================================================================
// 功能定义导出
// ================================================================

export const feature: AIFeatureDef = {
  id: 'ai_feynman',
  name: '费曼学习法',
  version: '1.0.0',
  register,
};
