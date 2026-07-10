import { RemoteAIPlugin } from './RemoteAIPlugin';
import { ElectronAIPlugin } from './ElectronAIPlugin';
import { LocalDurationRecommender } from './LocalFallback';
import { isElectron } from '../utils/platform';
import type { AIPlugin, DurationHistoryData, DurationOptions, DurationResult,
  SummarizeResult, FlashcardResult, EvaluateResult,
  SummarizeOptions, FlashcardOptions, EvaluateOptions } from './types';

/**
 * AI 插件加载器（单例）
 * Electron 插件、远程插件和本地降级
 */
class AIPluginLoader {
  private remotePlugin: RemoteAIPlugin | null = null;
  private electronPlugin: ElectronAIPlugin | null = null;
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
   * 获取 Electron AI 插件实例（懒加载）
   * 自动从 Supabase session 注入 authToken
   */
  async getElectronPlugin(): Promise<ElectronAIPlugin> {
    if (!this.electronPlugin) {
      this.electronPlugin = new ElectronAIPlugin();
    }
    try {
      const { supabase } = await import('../auth/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      this.electronPlugin.setAuthToken(session?.access_token ?? null);
    } catch (err) {
      console.error('[AI] Supabase token injection failed:', err);
    }
    return this.electronPlugin;
  }

  /**
   * 根据运行环境获取 AI 插件实例
   * Electron 环境 → IPC 通道
   * 其他 → 远程 HTTP
   */
  async getAIPlugin(): Promise<AIPlugin> {
    console.log('[AI] getAIPlugin called, isElectron:', isElectron());
    if (isElectron()) return await this.getElectronPlugin();
    return this.getRemotePlugin();
  }

  /**
   * 摘要功能
   */
  async summarizeNote(content: string, options?: SummarizeOptions): Promise<SummarizeResult> {
    console.log('[AI] summarizeNote, content length:', content.length);
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
