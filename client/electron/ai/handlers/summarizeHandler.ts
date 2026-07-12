/**
 * AI 摘要功能 Handler
 *
 * 处理 ai_summarize IPC 请求，调用 AI 网关生成文本摘要。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, type AIFeatureDef } from '../utils.js';

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
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[IPC] ai_summarize start, text_length=${args.text.length}`);
      const reqBody = {
        text: args.text,
        options: {
          ...(args.maxLength !== undefined && { max_length: args.maxLength }),
          ...(args.style !== undefined && { style: args.style }),
          ...(args.language !== undefined && { language: args.language }),
        },
      };

      interface SummarizeResp {
        summary: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      const { data: resp, requestId } = await postJson<typeof reqBody, SummarizeResp>(
        '/api/v1/ai/summarize',
        reqBody,
        args.authToken,
      );

      logger.info(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
      logger.info(`[IPC] ai_summarize end, model=${resp.model}`);
      return {
        summary: resp.summary,
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
  id: 'ai_summarize',
  name: 'AI 文本摘要',
  version: '1.0.0',
  register,
};
