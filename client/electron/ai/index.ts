/**
 * AI Handler 统一注册入口
 *
 * 汇总所有 AI 功能 handler，提供 registerAIHandlers() 函数
 * 一次性注册全部 AI IPC handler。
 */

import { logger } from '../logger.js';
import type { AIFeatureDef } from './utils.js';

// 导入所有 AI 功能模块
import { feature as summarizeFeature } from './handlers/summarizeHandler.js';
import { feature as flashcardFeature } from './handlers/flashcardHandler.js';
import { feature as evaluateFeature } from './handlers/evaluateHandler.js';
import { feature as feynmanFeature } from './handlers/feynmanHandler.js';
import { feature as tagFeature } from './handlers/tagHandler.js';
import { feature as recommendFeature } from './handlers/recommendHandler.js';

// ================================================================
// 功能注册表
// ================================================================

/** 所有已注册的 AI 功能模块 */
const features: AIFeatureDef[] = [
  summarizeFeature,
  flashcardFeature,
  evaluateFeature,
  feynmanFeature,
  tagFeature,
  recommendFeature,
];

// ================================================================
// 统一注册函数
// ================================================================

/**
 * 注册所有 AI IPC Handler
 *
 * 遍历功能注册表，依次调用每个功能的 register() 方法，
 * 将对应的 safeHandle 绑定到 ipcMain。
 */
export function registerAIHandlers(): void {
  logger.info(`[AI] Registering ${features.length} AI feature(s)...`);
  for (const feat of features) {
    feat.register();
    logger.info(`[AI] Registered: ${feat.name} (${feat.id}) v${feat.version}`);
  }
  logger.info('[AI] All AI handlers registered successfully');
}
