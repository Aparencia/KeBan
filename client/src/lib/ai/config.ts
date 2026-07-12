/**
 * AI 服务配置统一管理
 * 读写 localStorage 中的 AI 配置，供 SettingsPage、apiClient、AIPluginLoader 共用
 */

export interface AIConfig {
  provider: 'qwen' | 'deepseek' | 'glm' | 'custom';
  apiKey: string;
  gatewayUrl: string;
}

export const AI_CONFIG_STORAGE_KEY = 'kb_ai_config';

const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'qwen',
  apiKey: '',
  gatewayUrl: '',
};

/** 从 localStorage 读取 AI 配置，不存在则返回默认值 */
export function getAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_AI_CONFIG, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_AI_CONFIG };
}

/** 将 AI 配置持久化到 localStorage */
export function saveAIConfig(config: AIConfig): void {
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

/** 获取 AI 网关 URL，未配置时抛出明确错误 */
export function requireGatewayUrl(): string {
  const url = getAIConfig().gatewayUrl;
  if (!url) {
    throw new Error('[KeBan] AI Gateway URL not configured. Please set the gateway URL in AI settings or VITE_AI_GATEWAY_URL in .env');
  }
  return url;
}

/** 单独更新运行时 Gateway URL（供外部快速调用，同时持久化） */
export function updateAIGatewayUrl(url: string): void {
  const config = getAIConfig();
  config.gatewayUrl = url;
  saveAIConfig(config);
}
