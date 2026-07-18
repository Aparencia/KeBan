/**
 * AI 学习预测功能 Handler
 *
 * 处理 ai_predict IPC 请求，调用 AI 网关基于笔记内容生成预测性问题。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, gatewayUrl, type AIFeatureDef } from '../utils.js';

// ================================================================
// IPC Handler
// ================================================================

/**
 * ai_predict — POST /api/v1/ai/predict
 */
function register(): void {
  safeHandle(
    'ai_predict',
    async (
      _event,
      args: {
        content: string;
        authToken?: string;
        userApiKey?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[AI] [predict] IPC received: content_length=${args.content.length}, hasAuth=${!!args.authToken}`);
      logger.debug(`[AI] [predict] Content preview: ${args.content.slice(0, 80)}...`);

      const reqBody = { content: args.content };

      logger.info(`[AI] [predict] Target: ${gatewayUrl()}/api/v1/ai/predict`);

      interface PredictionResp {
        question: string;
        type: string;
        reason: string;
        curiosity_score: number;
      }
      interface PredictGenResp {
        predictions: PredictionResp[];
        status: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      try {
        const { data: resp, requestId } = await postJson<typeof reqBody, PredictGenResp>(
          '/api/v1/ai/predict',
          reqBody,
          args.authToken,
          args.userApiKey,
          60000,
        );

        const elapsed = Date.now() - startMs;
        logger.info(`[AI] [predict] ✔ Success: predictions=${resp.predictions.length}, status=${resp.status}, model=${resp.model}, tokens=${resp.tokens_used}, total=${elapsed}ms, reqId=${requestId ?? 'N/A'}`);
        return {
          predictions: resp.predictions.map((p) => ({
            question: p.question,
            type: p.type,
            reason: p.reason,
            curiosityScore: p.curiosity_score,
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
        logger.error(`[AI] [predict] ✖ Failed after ${elapsed}ms: ${error.message}`);
        if (error.cause) logger.error(`[AI] [predict] Error cause: ${error.cause}`);
        throw error;
      }
    },
  );
}

// ================================================================
// 功能定义导出
// ================================================================

export const feature: AIFeatureDef = {
  id: 'ai_predict',
  name: 'AI 学习预测',
  version: '1.0.0',
  register,
};
