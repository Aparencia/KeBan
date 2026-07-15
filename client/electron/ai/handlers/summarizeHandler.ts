/**
 * AI 摘要功能 Handler
 *
 * 处理 ai_summarize IPC 请求，调用 AI 网关生成文本摘要。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, gatewayUrl, type AIFeatureDef } from '../utils.js';

// ================================================================
// IPC Handler
// ================================================================

/**
 * ai_summarize — POST /api/v1/ai/summarize
 * 接收前端 camelCase 参数，转为后端 snake_case 请求体，
 * 再将后端 snake_case 响应转回 camelCase。
 */
function register(): void {
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
        userApiKey?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[AI] [summarize] IPC received: text_length=${args.text.length}, style=${args.style ?? 'default'}, language=${args.language ?? 'auto'}, maxLength=${args.maxLength ?? 'none'}, hasAuth=${!!args.authToken}`);
      logger.debug(`[AI] [summarize] Text preview: ${args.text.slice(0, 80)}...`);

      const reqBody = {
        text: args.text,
        options: {
          ...(args.maxLength != null && { max_length: args.maxLength }),
          ...(args.style != null && { style: args.style }),
          ...(args.language != null && { language: args.language }),
        },
      };

      logger.info(`[AI] [summarize] Target: ${gatewayUrl()}/api/v1/ai/summarize`);

      interface SummarizeResp {
        summary: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      try {
        const { data: resp, requestId } = await postJson<typeof reqBody, SummarizeResp>(
          '/api/v1/ai/summarize',
          reqBody,
          args.authToken,
          args.userApiKey,
          90000,
        );

        const elapsed = Date.now() - startMs;
        logger.info(`[AI] [summarize] ✔ Success: model=${resp.model}, tokens=${resp.tokens_used}, backend_latency=${resp.latency_ms}ms, total=${elapsed}ms, reqId=${requestId ?? 'N/A'}`);
        return {
          summary: resp.summary,
          model: resp.model,
          tokensUsed: resp.tokens_used,
          latencyMs: resp.latency_ms,
          requestId,
        };
      } catch (err) {
        const elapsed = Date.now() - startMs;
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[AI] [summarize] ✖ Failed after ${elapsed}ms: ${error.message}`);
        if (error.cause) logger.error(`[AI] [summarize] Error cause: ${error.cause}`);
        throw error;
      }
    },
  );
}

// ================================================================
// 功能定义导出
// ================================================================

export const feature: AIFeatureDef = {
  id: 'ai_summarize',
  name: 'AI 文本摘要',
  version: '1.0.0',
  register,
};
