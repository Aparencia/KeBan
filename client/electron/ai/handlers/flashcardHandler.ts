/**
 * AI 闪卡生成功能 Handler
 *
 * 处理 ai_generate_cards IPC 请求，调用 AI 网关从笔记生成闪卡。
 */

import { safeHandle } from '../../ipcUtils.js';
import { logger } from '../../logger.js';
import { postJson, type AIFeatureDef } from '../utils.js';

// ================================================================
// IPC Handler
// ================================================================

/**
 * ai_generate_cards — POST /api/v1/ai/generate-cards
 */
function register(): void {
  safeHandle(
    'ai_generate_cards',
    async (
      _event,
      args: {
        note: string;
        maxCards?: number;
        difficulty?: string;
        cardType?: string;
        authToken?: string;
      },
    ) => {
      const startMs = Date.now();
      logger.info(`[IPC] ai_generate_cards start, note_length=${args.note.length}`);
      const reqBody = {
        note: args.note,
        options: {
          ...(args.maxCards !== undefined && { max_cards: args.maxCards }),
          ...(args.difficulty !== undefined && { difficulty: args.difficulty }),
          ...(args.cardType !== undefined && { card_type: args.cardType }),
        },
      };

      interface CardResp {
        front: string;
        back: string;
        type: string;
        confidence: number;
      }
      interface CardGenResp {
        cards: CardResp[];
        total_extracted: number;
        model: string;
        tokens_used: number;
      }

      const { data: resp, requestId } = await postJson<typeof reqBody, CardGenResp>(
        '/api/v1/ai/generate-cards',
        reqBody,
        args.authToken,
      );

      logger.info(`[IPC] Request ID: ${requestId ?? 'N/A'}`);
      logger.info(`[IPC] ai_generate_cards end, cards_count=${resp.cards.length}`);
      return {
        cards: resp.cards.map((c) => ({
          front: c.front,
          back: c.back,
          type: c.type,
          confidence: c.confidence,
        })),
        totalExtracted: resp.total_extracted,
        model: resp.model,
        tokensUsed: resp.tokens_used,
        requestId,
      };
    },
  );
}

// ================================================================
// 功能定义导出
// ================================================================

export const feature: AIFeatureDef = {
  id: 'ai_generate_cards',
  name: 'AI 反衰减呼吸生成',
  version: '1.0.0',
  register,
};
