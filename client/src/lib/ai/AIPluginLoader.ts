import { RemoteAIPlugin } from './RemoteAIPlugin';
import { ElectronAIPlugin } from './ElectronAIPlugin';
import { LocalDurationRecommender } from './LocalFallback';
import { isElectron } from '../utils/platform';
import { AIError } from './types';
import type { AIPlugin, DurationHistoryData, DurationOptions, DurationResult,
  SummarizeResult, FlashcardResult, EvaluateResult,
  SummarizeOptions, FlashcardOptions, EvaluateOptions,
  VisionExtractResult } from './types';

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
   * 统一前置守卫：离线检查 + 内容长度校验
   */
  private async withGuard<T>(
    fn: () => Promise<T>,
    options: { contentCheck?: string; feature: string }
  ): Promise<T> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new AIError('当前处于离线状态，无法使用 AI 功能', 'offline', false);
    }
    if (options.contentCheck && options.contentCheck.trim().length < 10) {
      throw new AIError(
        '内容太短，无法进行 AI 分析。请至少输入 10 个字符。',
        'content_too_short',
        false
      );
    }
    return fn();
  }

  /**
   * 根据运行环境获取 AI 插件实例
   */
  async getAIPlugin(): Promise<AIPlugin> {
    if (isElectron()) return await this.getElectronPlugin();
    return this.getRemotePlugin();
  }

  /**
   * 摘要功能
   */
  async summarizeNote(content: string, options?: SummarizeOptions): Promise<SummarizeResult> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        return plugin.summarizeNote(content, options);
      })(),
      { contentCheck: content, feature: 'summarize' }
    );
  }

  /**
   * 闪卡生成
   */
  async generateFlashcards(content: string, options?: FlashcardOptions): Promise<FlashcardResult> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        return plugin.generateFlashcards(content, options);
      })(),
      { contentCheck: content, feature: 'flashcards' }
    );
  }

  /**
   * 费曼评估
   */
  async evaluateExplanation(concept: string, explanation: string, options?: EvaluateOptions): Promise<EvaluateResult> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        return plugin.evaluateExplanation(concept, explanation, options);
      })(),
      { contentCheck: explanation, feature: 'evaluate' }
    );
  }

  /**
   * 视觉内容提取 — 委托给已加载的插件（如有实现）
   */
  async extractScreenContent(imageBase64: string, language = 'zh'): Promise<VisionExtractResult> {
    const plugin = await this.getAIPlugin();
    if (plugin.extractScreenContent) {
      return plugin.extractScreenContent(imageBase64, language);
    }
    throw new AIError('当前 AI 插件不支持屏幕内容提取', 'service_unavailable', false);
  }

  /**
   * 番茄钟推荐 — 远程优先，失败时自动降级到本地规则引擎
   */
  async recommendDuration(historyData: DurationHistoryData, options?: DurationOptions): Promise<DurationResult> {
    return this.withGuard(
      async () => {
        try {
          return await (await this.getAIPlugin()).recommendDuration(historyData, options);
        } catch {
          return this.localRecommender.recommend(historyData, options);
        }
      },
      { feature: 'duration' }
    );
  }
}

// 单例
export const aiPluginLoader = new AIPluginLoader();
