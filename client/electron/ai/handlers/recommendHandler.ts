/**
 * AI 推荐时长功能 Handler
 *
 * 处理 ai_recommend_duration IPC 请求，
 * 调用 AI 网关根据学习历史推荐最佳学习时长。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, gatewayUrl, type AIFeatureDef } from '../utils.js';

// ================================================================
// IPC Handler
// ================================================================

/**
 * ai_recommend_duration — POST /api/v1/ai/recommend-duration
 */
function register(): void {
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
        userApiKey?: string;
      },
    ) => {
      // 前端 camelCase → 后端 snake_case
      const startMs = Date.now();
      logger.info(`[AI] [recommend] IPC received: sessions_count=${args.history.length}, hasAuth=${!!args.authToken}`);
      logger.debug(`[AI] [recommend] History preview: ${args.history.length} sessions, first=${args.history[0]?.timestamp ?? 'N/A'}, last=${args.history[args.history.length - 1]?.timestamp ?? 'N/A'}`);

      const reqBody = {
        history: args.history.map((h) => ({
          duration_minutes: h.durationMinutes,
          completed: h.completed,
          subject: h.subject,
          timestamp: h.timestamp,
        })),
      };

      logger.info(`[AI] [recommend] Target: ${gatewayUrl()}/api/v1/ai/recommend-duration`);

      interface RecommendResp {
        recommended_minutes: number;
        break_minutes: number;
        reason: string;
        source: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      try {
        const { data: resp, requestId } = await postJson<typeof reqBody, RecommendResp>(
          '/api/v1/ai/recommend-duration',
          reqBody,
          args.authToken,
          args.userApiKey,
          40000,
        );

        const elapsed = Date.now() - startMs;
        logger.info(`[AI] [recommend] ✔ Success: recommended=${resp.recommended_minutes}min, break=${resp.break_minutes}min, source=${resp.source}, model=${resp.model}, total=${elapsed}ms, reqId=${requestId ?? 'N/A'}`);
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
      } catch (err) {
        const elapsed = Date.now() - startMs;
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[AI] [recommend] ✖ Failed after ${elapsed}ms: ${error.message}`);
        if (error.cause) logger.error(`[AI] [recommend] Error cause: ${error.cause}`);
        throw error;
      }
    },
  );
}

// ================================================================
// 功能定义导出
// ================================================================

export const feature: AIFeatureDef = {
  id: 'ai_recommend_duration',
  name: 'AI 推荐学习时长',
  version: '1.0.0',
  register,
};
