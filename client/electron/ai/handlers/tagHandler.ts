/**
 * AI 标签/内容分类功能 Handler
 *
 * 处理 ai_tag_content 和 ai_sort_inspiration IPC 请求，
 * 调用 AI 网关进行内容分类和灵感归档。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, gatewayUrl, type AIFeatureDef } from '../utils.js';

// ================================================================
// IPC Handler
// ================================================================

/**
 * 注册标签/内容分类相关的所有 IPC handler
 */
function register(): void {
  /**
   * ai_tag_content — POST /api/v1/ai/tag-content
   */
  safeHandle(
    'ai_tag_content',
    async (
      _event,
      args: {
        content: string;
        authToken?: string;
        userApiKey?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[AI] [tag] IPC received: content_length=${args.content.length}, hasAuth=${!!args.authToken}`);
      logger.debug(`[AI] [tag] Content preview: ${args.content.slice(0, 80)}...`);

      const reqBody = { content: args.content };

      logger.info(`[AI] [tag] Target: ${gatewayUrl()}/api/v1/ai/tag-content`);

      interface TagContentResp {
        content_nature: string;
        cognitive_depth: string;
        subject: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      try {
        const { data: resp, requestId } = await postJson<typeof reqBody, TagContentResp>(
          '/api/v1/ai/tag-content',
          reqBody,
          args.authToken,
          args.userApiKey,
          30000,
        );

        const elapsed = Date.now() - startMs;
        logger.info(`[AI] [tag] ✔ Success: nature=${resp.content_nature}, depth=${resp.cognitive_depth}, subject=${resp.subject}, model=${resp.model}, total=${elapsed}ms, reqId=${requestId ?? 'N/A'}`);
        return {
          contentNature: resp.content_nature,
          cognitiveDepth: resp.cognitive_depth,
          subject: resp.subject,
          model: resp.model,
          tokensUsed: resp.tokens_used,
          latencyMs: resp.latency_ms,
          requestId,
        };
      } catch (err) {
        const elapsed = Date.now() - startMs;
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[AI] [tag] ✖ Failed after ${elapsed}ms: ${error.message}`);
        if (error.cause) logger.error(`[AI] [tag] Error cause: ${error.cause}`);
        throw error;
      }
    },
  );

  /**
   * ai_sort_inspiration — POST /api/v1/ai/sort-inspiration
   */
  safeHandle(
    'ai_sort_inspiration',
    async (
      _event,
      args: {
        content: string;
        existingTags?: Record<string, string>;
        authToken?: string;
        userApiKey?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[AI] [sort-insp] IPC received: content_length=${args.content.length}, existingTags=${args.existingTags ? Object.keys(args.existingTags).length : 0}, hasAuth=${!!args.authToken}`);
      logger.debug(`[AI] [sort-insp] Content preview: ${args.content.slice(0, 80)}...`);

      const reqBody = {
        content: args.content,
        existing_tags: args.existingTags,
      };

      logger.info(`[AI] [sort-insp] Target: ${gatewayUrl()}/api/v1/ai/sort-inspiration`);

      interface SortSuggestionResp {
        category: string;
        reason: string;
        confidence: number;
        suggested_action: string;
      }
      interface SortInspirationResp {
        suggestions: SortSuggestionResp[];
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      try {
        const { data: resp, requestId } = await postJson<typeof reqBody, SortInspirationResp>(
          '/api/v1/ai/sort-inspiration',
          reqBody,
          args.authToken,
          args.userApiKey,
          30000,
        );

        const elapsed = Date.now() - startMs;
        logger.info(`[AI] [sort-insp] ✔ Success: suggestions=${resp.suggestions.length}, model=${resp.model}, tokens=${resp.tokens_used}, total=${elapsed}ms, reqId=${requestId ?? 'N/A'}`);
        return {
          suggestions: resp.suggestions.map((s) => ({
            category: s.category,
            reason: s.reason,
            confidence: s.confidence,
            suggestedAction: s.suggested_action,
          })),
          model: resp.model,
          tokensUsed: resp.tokens_used,
          latencyMs: resp.latency_ms,
          requestId,
        };
      } catch (err) {
        const elapsed = Date.now() - startMs;
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[AI] [sort-insp] ✖ Failed after ${elapsed}ms: ${error.message}`);
        if (error.cause) logger.error(`[AI] [sort-insp] Error cause: ${error.cause}`);
        throw error;
      }
    },
  );
}

// ================================================================
// 功能定义导出
// ================================================================

export const feature: AIFeatureDef = {
  id: 'ai_tag',
  name: 'AI 标签与萤火海沟分类',
  version: '1.0.0',
  register,
};
