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
  provider: 'glm',
  apiKey: '',
  gatewayUrl: import.meta.env.VITE_AI_GATEWAY_URL || 'https://entropydecrease.com',
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
  const config = getAIConfig();
  // 优先使用用户配置，为空则回退到环境变量
  const url = config.gatewayUrl || import.meta.env.VITE_AI_GATEWAY_URL as string | undefined;
  if (!url) {
    throw new Error(
      '[熵减] AI Gateway URL 未配置。请在 AI 设置中填写网关地址，或在 .env 中设置 VITE_AI_GATEWAY_URL'
    );
  }
  return url;
}

/** 单独更新运行时 Gateway URL（供外部快速调用，同时持久化） */
export function updateAIGatewayUrl(url: string): void {
  const config = getAIConfig();
  config.gatewayUrl = url;
  saveAIConfig(config);
}
