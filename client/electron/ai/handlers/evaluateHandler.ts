/**
 * AI 评估功能 Handler
 *
 * 处理 ai_evaluate IPC 请求，调用 AI 网关评估用户对概念的解释。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, gatewayUrl, type AIFeatureDef } from '../utils.js';

// ================================================================
// IPC Handler
// ================================================================

/**
 * ai_evaluate — POST /api/v1/ai/evaluate-explanation
 */
function register(): void {
  safeHandle(
    'ai_evaluate',
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
      logger.info(`[AI] [evaluate] IPC received: concept_length=${args.concept.length}, explanation_length=${args.explanation.length}, hasAuth=${!!args.authToken}`);
      logger.debug(`[AI] [evaluate] Concept: ${args.concept.slice(0, 60)}, Explanation preview: ${args.explanation.slice(0, 80)}...`);

      const reqBody = {
        concept: args.concept,
        explanation: args.explanation,
      };

      logger.info(`[AI] [evaluate] Target: ${gatewayUrl()}/api/v1/ai/evaluate-explanation`);

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

      try {
        const { data: resp, requestId } = await postJson<typeof reqBody, EvaluateResp>(
          '/api/v1/ai/evaluate-explanation',
          reqBody,
          args.authToken,
          args.userApiKey,
          40000,
        );

        const elapsed = Date.now() - startMs;
        logger.info(`[AI] [evaluate] ✔ Success: overall_score=${resp.overall_score}, dimensions=${resp.dimensions.length}, model=${resp.model}, tokens=${resp.tokens_used}, total=${elapsed}ms, reqId=${requestId ?? 'N/A'}`);
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
      } catch (err) {
        const elapsed = Date.now() - startMs;
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[AI] [evaluate] ✖ Failed after ${elapsed}ms: ${error.message}`);
        if (error.cause) logger.error(`[AI] [evaluate] Error cause: ${error.cause}`);
        throw error;
      }
    },
  );
}

// ================================================================
// 功能定义导出
// ================================================================

export const feature: AIFeatureDef = {
  id: 'ai_evaluate',
  name: 'AI 解释评估',
  version: '1.0.0',
  register,
};
