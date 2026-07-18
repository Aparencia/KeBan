/**
 * AI 闪卡优化功能 Handler
 *
 * 处理 ai_optimize_card IPC 请求，调用 AI 网关优化已有闪卡的正反面内容。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, gatewayUrl, type AIFeatureDef } from '../utils.js';

// ================================================================
// IPC Handler
// ================================================================

/**
 * ai_optimize_card — POST /api/v1/ai/optimize-card
 */
function register(): void {
  safeHandle(
    'ai_optimize_card',
    async (
      _event,
      args: {
        front: string;
        back: string;
        authToken?: string;
        userApiKey?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[AI] [optimize-card] IPC received: front_length=${args.front.length}, back_length=${args.back.length}, hasAuth=${!!args.authToken}`);
      logger.debug(`[AI] [optimize-card] Front preview: ${args.front.slice(0, 60)}, Back preview: ${args.back.slice(0, 60)}`);

      const reqBody = {
        front: args.front,
        back: args.back,
      };

      logger.info(`[AI] [optimize-card] Target: ${gatewayUrl()}/api/v1/ai/optimize-card`);

      interface OptimizeCardResp {
        suggested_front: string;
        suggested_back: string;
        improvements: string[];
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      try {
        const { data: resp, requestId } = await postJson<typeof reqBody, OptimizeCardResp>(
          '/api/v1/ai/optimize-card',
          reqBody,
          args.authToken,
          args.userApiKey,
          60000,
        );

        const elapsed = Date.now() - startMs;
        logger.info(`[AI] [optimize-card] ✔ Success: improvements=${resp.improvements.length}, model=${resp.model}, tokens=${resp.tokens_used}, total=${elapsed}ms, reqId=${requestId ?? 'N/A'}`);
        return {
          suggestedFront: resp.suggested_front,
          suggestedBack: resp.suggested_back,
          improvements: resp.improvements,
          model: resp.model,
          tokensUsed: resp.tokens_used,
          latencyMs: resp.latency_ms,
          requestId,
        };
      } catch (err) {
        const elapsed = Date.now() - startMs;
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[AI] [optimize-card] ✖ Failed after ${elapsed}ms: ${error.message}`);
        if (error.cause) logger.error(`[AI] [optimize-card] Error cause: ${error.cause}`);
        throw error;
      }
    },
  );
}

// ================================================================
// 功能定义导出
// ================================================================

export const feature: AIFeatureDef = {
  id: 'ai_optimize_card',
  name: 'AI 闪卡优化',
  version: '1.0.0',
  register,
};
