import { RemoteAIPlugin } from './RemoteAIPlugin';
import { LocalDurationRecommender } from './LocalFallback';
import type { DurationHistoryData, DurationOptions, DurationResult,
  SummarizeResult, FlashcardResult, EvaluateResult,
  SummarizeOptions, FlashcardOptions, EvaluateOptions } from './types';

/**
 * AI 插件加载器（单例）
 * 管理远程 AI 插件和本地降级
 */
class AIPluginLoader {
  private remotePlugin: RemoteAIPlugin | null = null;
  private localRecommender: LocalDurationRecommender;

  constructor() {
    this.localRecommender = new LocalDurationRecommender();
  }

  /**
   * 获取远程 AI 插件实例（懒加载）
   */
  getRemotePlugin(): RemoteAIPlugin {
    if (!this.remotePlugin) {
      this.remotePlugin = new RemoteAIPlugin();
    }
    return this.remotePlugin;
  }

  /**
   * 摘要功能 — 远程调用，失败时返回降级提示
   */
  async summarizeNote(content: string, options?: SummarizeOptions): Promise<SummarizeResult> {
    return this.getRemotePlugin().summarizeNote(content, options);
  }

  /**
   * 闪卡生成 — 远程调用，失败时返回降级提示
   */
  async generateFlashcards(content: string, options?: FlashcardOptions): Promise<FlashcardResult> {
    return this.getRemotePlugin().generateFlashcards(content, options);
  }

  /**
   * 费曼评估 — 远程调用，失败时返回降级提示
   */
  async evaluateExplanation(concept: string, explanation: string, options?: EvaluateOptions): Promise<EvaluateResult> {
    return this.getRemotePlugin().evaluateExplanation(concept, explanation, options);
  }

  /**
   * 番茄钟推荐 — 远程优先，失败时自动降级到本地规则引擎
   */
  async recommendDuration(historyData: DurationHistoryData, options?: DurationOptions): Promise<DurationResult> {
    try {
      return await this.getRemotePlugin().recommendDuration(historyData, options);
    } catch {
      // 自动降级到本地推荐
      return this.localRecommender.recommend(historyData, options);
    }
  }
}

// 单例
export const aiPluginLoader = new AIPluginLoader();
