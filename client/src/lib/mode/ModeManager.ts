/**
 * 应用运行模式管理器
 *
 * local:  纯本地模式（无网络、无账户）
 * hybrid: 本地优先 + 可选同步（已登录、有网络）
 * full:   完全云端模式（实时同步）
 */

export type AppMode = 'local' | 'hybrid' | 'full';

export interface ModeConfig {
  mode: AppMode;
  syncEnabled: boolean;
  aiEnabled: boolean;
  cloudStorageEnabled: boolean;
}

const STORAGE_KEY = 'keban_app_mode';
const VALID_MODES: ReadonlySet<AppMode> = new Set(['local', 'hybrid', 'full']);

type ModeListener = (mode: AppMode, config: ModeConfig) => void;

class ModeManager {
  private currentMode: AppMode = 'local';
  private listeners: Set<ModeListener> = new Set();

  constructor() {
    // 从 localStorage 恢复上次的模式
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as AppMode | null;
      if (saved && VALID_MODES.has(saved)) {
        this.currentMode = saved;
      }
    } catch {
      // localStorage 不可用时保持默认值 'local'
    }
  }

  /**
   * 获取当前运行模式
   */
  getMode(): AppMode {
    return this.currentMode;
  }

  /**
   * 获取当前模式对应的功能配置
   */
  getConfig(): ModeConfig {
    switch (this.currentMode) {
      case 'local':
        return {
          mode: 'local',
          syncEnabled: false,
          aiEnabled: false,
          cloudStorageEnabled: false,
        };
      case 'hybrid':
        return {
          mode: 'hybrid',
          syncEnabled: true,
          aiEnabled: true,
          cloudStorageEnabled: false,
        };
      case 'full':
        return {
          mode: 'full',
          syncEnabled: true,
          aiEnabled: true,
          cloudStorageEnabled: true,
        };
    }
  }

  /**
   * 切换运行模式
   * 会持久化到 localStorage 并通知所有订阅者
   */
  setMode(mode: AppMode): void {
    if (!VALID_MODES.has(mode)) return;

    this.currentMode = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // 忽略存储失败
    }
    const config = this.getConfig();
    this.listeners.forEach((listener) => listener(mode, config));
  }

  /**
   * 订阅模式变化
   * 返回取消订阅函数
   */
  subscribe(listener: ModeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 当前模式下 AI 功能是否可用 */
  isAIEnabled(): boolean {
    return this.getConfig().aiEnabled;
  }

  /** 当前模式下同步功能是否可用 */
  isSyncEnabled(): boolean {
    return this.getConfig().syncEnabled;
  }

  /**
   * 根据认证和网络状态自动计算推荐模式
   */
  computeRecommendedMode(isAuthenticated: boolean, isOnline: boolean): AppMode {
    if (!isAuthenticated) return 'local';
    if (!isOnline) return 'hybrid';
    return 'full';
  }
}

// 单例导出
export const modeManager = new ModeManager();
