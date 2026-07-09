import { RemoteAIPlugin } from './RemoteAIPlugin';
import { TauriAIPlugin } from './TauriAIPlugin';
import { LocalDurationRecommender } from './LocalFallback';
import { isTauri } from '../utils/platform';
import type { AIPlugin, DurationHistoryData, DurationOptions, DurationResult,
  SummarizeResult, FlashcardResult, EvaluateResult,
  SummarizeOptions, FlashcardOptions, EvaluateOptions } from './types';

/**
 * AI 插件加载器（单例）
 * 管理远程 AI 插件、Tauri 插件和本地降级
 */
class AIPluginLoader {
  private remotePlugin: RemoteAIPlugin | null = null;
  private tauriPlugin: TauriAIPlugin | null = null;
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
   * 获取 Tauri AI 插件实例（懒加载）
   * 自动从 Supabase session 注入 authToken
   */
  async getTauriPlugin(): Promise<TauriAIPlugin> {
    if (!this.tauriPlugin) {
      this.tauriPlugin = new TauriAIPlugin();
    }
    // 自动注入 Supabase auth token（与 RemoteAIPlugin/apiClient 对齐）
    try {
      const { supabase } = await import('../auth/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      this.tauriPlugin.setAuthToken(session?.access_token ?? null);
    } catch (err) {
      // supabase 不可用时静默降级（兼容 JWT 开发模式）
      console.warn('[AIPluginLoader] Supabase token injection skipped:', err);
    }
    return this.tauriPlugin;
  }

  /**
   * 根据运行环境获取 AI 插件实例
   * Tauri 环境优先使用 Rust invoke 通道，否则使用远程 HTTP
   */
  async getAIPlugin(): Promise<AIPlugin> {
    return isTauri() ? await this.getTauriPlugin() : this.getRemotePlugin();
  }

  /**
   * 摘要功能
   */
  async summarizeNote(content: string, options?: SummarizeOptions): Promise<SummarizeResult> {
    return (await this.getAIPlugin()).summarizeNote(content, options);
  }

  /**
   * 闪卡生成
   */
  async generateFlashcards(content: string, options?: FlashcardOptions): Promise<FlashcardResult> {
    return (await this.getAIPlugin()).generateFlashcards(content, options);
  }

  /**
   * 费曼评估
   */
  async evaluateExplanation(concept: string, explanation: string, options?: EvaluateOptions): Promise<EvaluateResult> {
    return (await this.getAIPlugin()).evaluateExplanation(concept, explanation, options);
  }

  /**
   * 番茄钟推荐 — 远程优先，失败时自动降级到本地规则引擎
   */
  async recommendDuration(historyData: DurationHistoryData, options?: DurationOptions): Promise<DurationResult> {
    try {
      return await (await this.getAIPlugin()).recommendDuration(historyData, options);
    } catch {
      // 自动降级到本地推荐
      return this.localRecommender.recommend(historyData, options);
    }
  }
}

// 单例
export const aiPluginLoader = new AIPluginLoader();
