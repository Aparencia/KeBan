import { create } from 'zustand';
import { getAIConfig, saveAIConfig as persistAIConfig, updateAIGatewayUrl } from '@/lib/ai/config';
import type { AIConfig } from '@/lib/ai/config';
import { saveUserKeys as persistUserKeys, getUserKeys, clearUserKeys as persistClearUserKeys } from '@/lib/ai/apiKeyManager';
import type { AIProviderKeys } from '@/lib/ai/apiKeyManager';

interface SettingsState {
  /** AI 服务配置 */
  aiConfig: AIConfig;
  /** 是否显示 AI 主 API Key */
  showApiKey: boolean;
  /** 用户自配置 API Keys */
  userKeys: AIProviderKeys;
  /** 各 provider Key 可见性 */
  showUserKey: Record<string, boolean>;

  /** 更新 AI 配置（内存态） */
  setAIConfig: (config: AIConfig) => void;
  /** 切换 AI 主 API Key 可见性 */
  toggleShowApiKey: () => void;
  /** 更新用户 Key（内存态） */
  setUserKeys: (keys: AIProviderKeys | ((prev: AIProviderKeys) => AIProviderKeys)) => void;
  /** 切换指定 provider Key 可见性 */
  toggleUserKeyVisibility: (provider: string) => void;

  /** 保存 AI 配置到 localStorage */
  saveAIConfigAction: () => void;
  /** 保存用户 Keys 到 localStorage */
  saveUserKeysAction: () => void;
  /** 清除用户 Keys */
  clearUserKeysAction: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  aiConfig: getAIConfig(),
  showApiKey: false,
  userKeys: getUserKeys(),
  showUserKey: {},

  setAIConfig: (config) => set({ aiConfig: config }),

  toggleShowApiKey: () => set((state) => ({ showApiKey: !state.showApiKey })),

  setUserKeys: (keys) => {
    if (typeof keys === 'function') {
      set((state) => ({ userKeys: keys(state.userKeys) }));
    } else {
      set({ userKeys: keys });
    }
  },

  toggleUserKeyVisibility: (provider) =>
    set((state) => ({
      showUserKey: { ...state.showUserKey, [provider]: !state.showUserKey[provider] },
    })),

  saveAIConfigAction: () => {
    const { aiConfig } = get();
    persistAIConfig(aiConfig);
    updateAIGatewayUrl(aiConfig.gatewayUrl);
  },

  saveUserKeysAction: () => {
    const { userKeys } = get();
    persistUserKeys(userKeys);
  },

  clearUserKeysAction: () => {
    persistClearUserKeys();
    set({ userKeys: {} });
  },
}));
