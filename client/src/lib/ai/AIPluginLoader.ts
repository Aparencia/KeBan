import { RemoteAIPlugin } from './RemoteAIPlugin';
import { ElectronAIPlugin } from './ElectronAIPlugin';
import { LocalDurationRecommender } from './LocalFallback';
import { isElectron } from '../utils/platform';
import { AIError } from './types';
import type { AIPlugin, DurationHistoryData, DurationOptions, DurationResult,
  SummarizeResult, FlashcardResult, EvaluateResult,
  SummarizeOptions, FlashcardOptions, EvaluateOptions,
  VisionExtractResult, TagContentResult, OptimizeCardResult,
  FeynmanQuestionResult, FeynmanAnswerEvalResult, SortResult,
  AnchorPoint, BrainstormIdea, ChatMessage, SocraticEvaluateResult, SocraticDeepeningResult,
  PredictionPrompt, RescueContext, ResourceLink } from './types';

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
    } catch {
      // Supabase token injection failed, proceed with null token
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

  /**
   * 费曼反问 — 生成 1-3 个追问
   */
  async generateFeynmanQuestions(concept: string, explanation: string): Promise<FeynmanQuestionResult> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        // RemoteAIPlugin has the method; AIPlugin interface may not require it
        return plugin.generateFeynmanQuestions(concept, explanation);
      })(),
      { contentCheck: explanation, feature: 'feynman_question' }
    );
  }

  /**
   * 费曼回答评估 — 评估用户对追问的回答
   */
  async evaluateFeynmanAnswers(
    concept: string,
    questions: string[],
    answers: string[],
  ): Promise<FeynmanAnswerEvalResult> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        return plugin.evaluateFeynmanAnswers(concept, questions, answers);
      })(),
      { feature: 'feynman_evaluate' }
    );
  }

  /**
   * 内容打标
   */
  async tagContent(content: string): Promise<TagContentResult> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        if (plugin.tagContent) {
          return plugin.tagContent(content);
        }
        throw new AIError('当前 AI 插件不支持内容打标', 'service_unavailable', false);
      })(),
      { contentCheck: content, feature: 'tag_content' }
    );
  }

  /**
   * 闪卡优化
   */
  async optimizeCard(front: string, back: string): Promise<OptimizeCardResult> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        if (plugin.optimizeCard) {
          return plugin.optimizeCard(front, back);
        }
        throw new AIError('当前 AI 插件不支持闪卡优化', 'service_unavailable', false);
      })(),
      { contentCheck: front + back, feature: 'optimize_card' }
    );
  }

  /**
   * 灵感分拣 — AI 分析内容并推荐归类目标
   */
  async sortInspiration(content: string, existingTags?: Record<string, string>): Promise<SortResult> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        if (plugin.sortInspiration) {
          return plugin.sortInspiration(content, existingTags);
        }
        throw new AIError('当前 AI 插件不支持灵感分拣', 'service_unavailable', false);
      })(),
      { contentCheck: content, feature: 'sort_inspiration' }
    );
  }

  /**
   * 记忆锚点生成 — 从笔记中提取知识锚点
   */
  async generateAnchorPoint(noteId: string, content: string): Promise<{ anchorPoints: AnchorPoint[] }> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        if (plugin.generateAnchorPoint) {
          return plugin.generateAnchorPoint(noteId, content);
        }
        throw new AIError('当前 AI 插件不支持锚点生成', 'service_unavailable', false);
      })(),
      { contentCheck: content, feature: 'anchor_point' }
    );
  }

  /**
   * 苏格拉底式头脑风暴 — 激发创意与联想
   */
  async socraticBrainstorm(topic: string, context?: string): Promise<{ ideas: BrainstormIdea[] }> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        if (plugin.socraticBrainstorm) {
          return plugin.socraticBrainstorm(topic, context);
        }
        throw new AIError('当前 AI 插件不支持苏格拉底头脑风暴', 'service_unavailable', false);
      })(),
      { contentCheck: topic, feature: 'socratic_brainstorm' }
    );
  }

  /**
   * 苏格拉底式追问 — 引导深度思考
   */
  async socraticQuestion(
    conversationId: string,
    topic: string,
    history: ChatMessage[],
  ): Promise<{ question: string; hints: string[] }> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        if (plugin.socraticQuestion) {
          return plugin.socraticQuestion(conversationId, topic, history);
        }
        throw new AIError('当前 AI 插件不支持苏格拉底追问', 'service_unavailable', false);
      })(),
      { contentCheck: topic, feature: 'socratic_question' }
    );
  }

  /**
   * FEAT-022: 苏格拉底回答评估 — 四维度评分
   */
  async socraticEvaluate(
    topic: string,
    question: string,
    answer: string,
    history: ChatMessage[],
  ): Promise<SocraticEvaluateResult> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        if (plugin.socraticEvaluate) {
          return plugin.socraticEvaluate(topic, question, answer, history);
        }
        throw new AIError('当前 AI 插件不支持苏格拉底评估', 'service_unavailable', false);
      })(),
      { contentCheck: answer, feature: 'socratic_evaluate' }
    );
  }

  /**
   * FEAT-022: 苏格拉底深化角度生成
   */
  async socraticDeepening(
    topic: string,
    dialogueSummary: string,
    history: ChatMessage[],
  ): Promise<SocraticDeepeningResult> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        if (plugin.socraticDeepening) {
          return plugin.socraticDeepening(topic, dialogueSummary, history);
        }
        throw new AIError('当前 AI 插件不支持苏格拉底深化', 'service_unavailable', false);
      })(),
      { contentCheck: topic, feature: 'socratic_deepening' }
    );
  }

  /**
   * 学习预测 — 基于笔记预测可能的问题
   */
  async predictQuestion(noteId: string, content: string): Promise<{ predictions: PredictionPrompt[] }> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        if (plugin.predictQuestion) {
          return plugin.predictQuestion(noteId, content);
        }
        throw new AIError('当前 AI 插件不支持学习预测', 'service_unavailable', false);
      })(),
      { contentCheck: content, feature: 'predict' }
    );
  }

  /**
   * 学习救援 — 当用户卡住时提供提示与资源
   */
  async rescue(context: RescueContext): Promise<{ hints: string[]; resources: ResourceLink[]; alternativeApproach?: string }> {
    return this.withGuard(
      () => (async () => {
        const plugin = await this.getAIPlugin();
        if (plugin.rescue) {
          return plugin.rescue(context);
        }
        throw new AIError('当前 AI 插件不支持学习救援', 'service_unavailable', false);
      })(),
      { contentCheck: context.topic, feature: 'rescue' }
    );
  }
}

// 单例
export const aiPluginLoader = new AIPluginLoader();
