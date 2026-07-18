/**
 * AI 记忆锚点生成功能 Handler
 *
 * 处理 ai_anchor_point IPC 请求，调用 AI 网关从笔记内容生成记忆锚点。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, gatewayUrl, type AIFeatureDef } from '../utils.js';

// ================================================================
// IPC Handler
// ================================================================

/**
 * ai_anchor_point — POST /api/v1/ai/anchor-point
 */
function register(): void {
  safeHandle(
    'ai_anchor_point',
    async (
      _event,
      args: {
        content: string;
        title?: string;
        authToken?: string;
        userApiKey?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[AI] [anchor-point] IPC received: content_length=${args.content.length}, title=${args.title ?? '(empty)'}, hasAuth=${!!args.authToken}`);
      logger.debug(`[AI] [anchor-point] Content preview: ${args.content.slice(0, 80)}...`);

      const reqBody = {
        content: args.content,
        title: args.title ?? '',
      };

      logger.info(`[AI] [anchor-point] Target: ${gatewayUrl()}/api/v1/ai/anchor-point`);

      interface AnchorPointResp {
        concept: string;
        association: string;
        memory_technique: string;
        importance: number;
      }
      interface AnchorPointGenResp {
        anchor_points: AnchorPointResp[];
        status: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      try {
        const { data: resp, requestId } = await postJson<typeof reqBody, AnchorPointGenResp>(
          '/api/v1/ai/anchor-point',
          reqBody,
          args.authToken,
          args.userApiKey,
          60000,
        );

        const elapsed = Date.now() - startMs;
        logger.info(`[AI] [anchor-point] ✔ Success: anchor_points=${resp.anchor_points.length}, status=${resp.status}, model=${resp.model}, tokens=${resp.tokens_used}, total=${elapsed}ms, reqId=${requestId ?? 'N/A'}`);
        return {
          anchorPoints: resp.anchor_points.map((ap) => ({
            concept: ap.concept,
            association: ap.association,
            memoryTechnique: ap.memory_technique,
            importance: ap.importance,
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
        logger.error(`[AI] [anchor-point] ✖ Failed after ${elapsed}ms: ${error.message}`);
        if (error.cause) logger.error(`[AI] [anchor-point] Error cause: ${error.cause}`);
        throw error;
      }
    },
  );
}

// ================================================================
// 功能定义导出
// ================================================================

export const feature: AIFeatureDef = {
  id: 'ai_anchor_point',
  name: 'AI 记忆锚点',
  version: '1.0.0',
  register,
};
