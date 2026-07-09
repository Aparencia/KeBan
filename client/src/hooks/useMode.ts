import { useState, useEffect, useCallback } from 'react';
import { modeManager, type AppMode, type ModeConfig } from '../lib/mode/ModeManager';
import { useAuth } from '../lib/auth/AuthContext';
import { useToast } from '../components/ui/Toast';
import { useNetworkStatus } from './useNetworkStatus';
import { getUnsyncedLogs } from '../lib/storage/operationLog';

/**
 * 轻量版：仅订阅模式状态，不依赖 Auth/Toast 上下文
 * 适用于 Navbar 等只需展示模式的位置
 */
export function useModeState() {
  const [mode, setMode] = useState<AppMode>(modeManager.getMode());
  const [config, setConfig] = useState<ModeConfig>(modeManager.getConfig());

  useEffect(() => {
    const unsubscribe = modeManager.subscribe((newMode, newConfig) => {
      setMode(newMode);
      setConfig(newConfig);
    });
    return unsubscribe;
  }, []);

  return { mode, config };
}

/**
 * 完整版：包含模式切换逻辑（含过渡保护）
 * 必须在 AuthProvider + ToastProvider 内使用
 */
export function useMode() {
  const { mode, config } = useModeState();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();

  const changeMode = useCallback(async (newMode: AppMode): Promise<boolean> => {
    const currentMode = modeManager.getMode();
    if (currentMode === newMode) return true;

    // local → hybrid/full：检查是否已登录
    if (currentMode === 'local' && (newMode === 'hybrid' || newMode === 'full')) {
      if (!isAuthenticated) {
        toast({ type: 'warning', message: '请先登录后再开启云同步' });
        return false;
      }
    }

    // hybrid/full → local：检查未同步数据
    if ((currentMode === 'hybrid' || currentMode === 'full') && newMode === 'local') {
      try {
        const unsyncedLogs = await getUnsyncedLogs();
        if (unsyncedLogs.length > 0) {
          const confirmed = window.confirm(
            `当前有 ${unsyncedLogs.length} 条未同步的修改，切换到本地模式后这些数据将不会同步到云端。\n确定要切换吗？`,
          );
          if (!confirmed) return false;
        }
      } catch {
        // 检查失败时仍允许切换
      }
    }

    modeManager.setMode(newMode);
    const labels: Record<AppMode, string> = { local: '本地模式', hybrid: '混合模式', full: '云端模式' };
    toast({ type: 'success', message: `已切换到${labels[newMode]}` });
    return true;
  }, [isAuthenticated, toast]);

  // 推荐模式（仅展示用，不强制切换）
  const recommendedMode = modeManager.computeRecommendedMode(isAuthenticated, isOnline);

  return { mode, config, changeMode, recommendedMode };
}
