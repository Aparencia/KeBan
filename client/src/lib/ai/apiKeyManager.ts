/**
 * AI 模型 API Key 用户自配置管理
 *
 * 用户配置的 Key 仅存 localStorage，不发送到前端日志。
 * 当用户有自配 Key 时，请求中附加 X-User-API-Key header（由后端决定是否使用）。
 */

export interface AIProviderKeys {
  glm?: string;
  qwen?: string;
  deepseek?: string;
}

const STORAGE_KEY = 'keban_ai_keys';

/**
 * 保存用户 API Keys 到 localStorage
 */
export function saveUserKeys(keys: AIProviderKeys): void {
  // 过滤空字符串，只保存有效值
  const cleaned: AIProviderKeys = {};
  if (keys.glm?.trim()) cleaned.glm = keys.glm.trim();
  if (keys.qwen?.trim()) cleaned.qwen = keys.qwen.trim();
  if (keys.deepseek?.trim()) cleaned.deepseek = keys.deepseek.trim();

  if (Object.keys(cleaned).length === 0) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  }
}

/**
 * 获取用户配置的 API Keys
 */
export function getUserKeys(): AIProviderKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AIProviderKeys>;
      return {
        glm: typeof parsed.glm === 'string' ? parsed.glm : undefined,
        qwen: typeof parsed.qwen === 'string' ? parsed.qwen : undefined,
        deepseek: typeof parsed.deepseek === 'string' ? parsed.deepseek : undefined,
      };
    }
  } catch {
    /* localStorage 损坏或不可用，静默忽略 */
  }
  return {};
}

/**
 * 检查是否有任何用户配置的有效 Key
 */
export function hasUserKeys(): boolean {
  const keys = getUserKeys();
  return Boolean(keys.glm || keys.qwen || keys.deepseek);
}

/**
 * 清除所有用户 API Keys
 */
export function clearUserKeys(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 获取指定 Provider 的 Key（仅用户自配置的）
 * @param provider - provider 标识：'glm' | 'qwen' | 'deepseek'
 * @returns 用户配置的 key，未配置则返回 undefined
 */
export function getProviderKey(provider: string): string | undefined {
  const keys = getUserKeys();
  switch (provider) {
    case 'glm':
      return keys.glm;
    case 'qwen':
      return keys.qwen;
    case 'deepseek':
      return keys.deepseek;
    default:
      return undefined;
  }
}

/**
 * 获取当前应附加到请求中的 User API Key
 * 优先返回主 provider 的 key，其次返回任意已配置的 key
 */
export function getActiveUserKey(): string | undefined {
  const keys = getUserKeys();
  // 按优先级返回：glm（免费模型）> qwen > deepseek
  return keys.glm || keys.qwen || keys.deepseek;
}
