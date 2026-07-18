/**
 * AI 学习救援功能 Handler
 *
 * 处理 ai_rescue IPC 请求，调用 AI 网关为卡住的学习者提供分层救援提示。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, gatewayUrl, type AIFeatureDef } from '../utils.js';

// ================================================================
// IPC Handler
// ================================================================

/**
 * ai_rescue — POST /api/v1/ai/rescue
 */
function register(): void {
  safeHandle(
    'ai_rescue',
    async (
      _event,
      args: {
        content: string;
        stuckDescription: string;
        attemptedMethods?: string;
        authToken?: string;
        userApiKey?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[AI] [rescue] IPC received: content_length=${args.content.length}, stuck_length=${args.stuckDescription.length}, methods=${args.attemptedMethods ?? 'none'}, hasAuth=${!!args.authToken}`);
      logger.debug(`[AI] [rescue] Stuck description: ${args.stuckDescription.slice(0, 80)}`);

      // 前端 camelCase → 后端 snake_case
      const reqBody = {
        content: args.content,
        stuck_description: args.stuckDescription,
        attempted_methods: args.attemptedMethods ?? '',
      };

      logger.info(`[AI] [rescue] Target: ${gatewayUrl()}/api/v1/ai/rescue`);

      interface RescueLevelResp {
        level: number;
        label: string;
        suggestion: string;
        hint_question: string;
      }
      interface RescueGenResp {
        rescue_levels: RescueLevelResp[];
        encouragement: string;
        status: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      try {
        const { data: resp, requestId } = await postJson<typeof reqBody, RescueGenResp>(
          '/api/v1/ai/rescue',
          reqBody,
          args.authToken,
          args.userApiKey,
          60000,
        );

        const elapsed = Date.now() - startMs;
        logger.info(`[AI] [rescue] ✔ Success: levels=${resp.rescue_levels.length}, status=${resp.status}, model=${resp.model}, tokens=${resp.tokens_used}, total=${elapsed}ms, reqId=${requestId ?? 'N/A'}`);
        return {
          rescueLevels: resp.rescue_levels.map((lv) => ({
            level: lv.level,
            label: lv.label,
            suggestion: lv.suggestion,
            hintQuestion: lv.hint_question,
          })),
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
        logger.error(`[AI] [rescue] ✖ Failed after ${elapsed}ms: ${error.message}`);
        if (error.cause) logger.error(`[AI] [rescue] Error cause: ${error.cause}`);
        throw error;
      }
    },
  );
}

// ================================================================
// 功能定义导出
// ================================================================

export const feature: AIFeatureDef = {
  id: 'ai_rescue',
  name: 'AI 学习救援',
  version: '1.0.0',
  register,
};
