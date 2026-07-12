/**
 * AI 评估功能 Handler
 *
 * 处理 ai_evaluate IPC 请求，调用 AI 网关评估用户对概念的解释。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, type AIFeatureDef } from '../utils.js';

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
