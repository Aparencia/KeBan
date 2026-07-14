/**
 * AI 标签/内容分类功能 Handler
 *
 * 处理 ai_tag_content 和 ai_sort_inspiration IPC 请求，
 * 调用 AI 网关进行内容分类和灵感归档。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, type AIFeatureDef } from '../utils.js';

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
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[IPC] ai_tag_content start, content_length=${args.content.length}`);
      const reqBody = { content: args.content };

      interface TagContentResp {
        content_nature: string;
        cognitive_depth: string;
        subject: string;
        model: string;
        tokens_used: number;
        latency_ms: number;
      }

      const { data: resp, requestId } = await postJson<typeof reqBody, TagContentResp>(
        '/api/v1/ai/tag-content',
        reqBody,
        args.authToken,
      );

      logger.info(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
      logger.info(`[IPC] ai_tag_content end, nature=${resp.content_nature}`);
      return {
        contentNature: resp.content_nature,
        cognitiveDepth: resp.cognitive_depth,
        subject: resp.subject,
        model: resp.model,
        tokensUsed: resp.tokens_used,
        latencyMs: resp.latency_ms,
        requestId,
      };
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
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[IPC] ai_sort_inspiration start, content_length=${args.content.length}`);
      const reqBody = {
        content: args.content,
        existing_tags: args.existingTags,
      };

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

      const { data: resp, requestId } = await postJson<typeof reqBody, SortInspirationResp>(
        '/api/v1/ai/sort-inspiration',
        reqBody,
        args.authToken,
      );

      logger.info(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
      logger.info(`[IPC] ai_sort_inspiration end, suggestions_count=${resp.suggestions.length}`);
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
