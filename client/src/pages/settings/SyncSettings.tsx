import { useState, useCallback, useMemo } from 'react';
import { Card, Modal, Button } from '@/components/ui';
import { useMode } from '@/hooks/useMode';
import type { AppMode } from '@/lib/mode/ModeManager';
import { HardDrive, Cloud, Globe, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 切换到云端模式时的确认说明 */
const confirmMessages: Partial<Record<AppMode, { title: string; description: string }>> = {
  full: {
    title: '切换到完全云端模式',
    description: '开启后，你的笔记、闪卡、费曼记录等数据将实时同步到云端服务器，支持多设备共享。请确保你已了解数据同步范围。',
  },
  hybrid: {
    title: '切换到混合模式',
    description: '开启后，数据以本地存储为主，联网时自动备份到云端。离线期间的修改将在恢复网络后排队同步。',
  },
};

export default function SyncSettings() {
  const { mode, changeMode, recommendedMode } = useMode();
  const [pendingMode, setPendingMode] = useState<AppMode | null>(null);

  /** 同步模式选项 */
  const modeOptions = useMemo(() => [
    { modeKey: 'local' as AppMode, label: '本地优先', desc: '数据仅存储在本地，不启用云同步', icon: HardDrive },
    { modeKey: 'hybrid' as AppMode, label: '混合模式', desc: '本地存储 + 云端备份，离线时自动排队', icon: Cloud },
    { modeKey: 'full' as AppMode, label: '完全云端', desc: '数据实时同步到云端，多设备共享', icon: Globe },
  ], []);

  const handleModeClick = useCallback((targetMode: AppMode) => {
    if (targetMode === mode) return;
    // 切换到 hybrid 或 full 时弹出确认
    if (confirmMessages[targetMode]) {
      setPendingMode(targetMode);
    } else {
      changeMode(targetMode);
    }
  }, [mode, changeMode]);

  const handleConfirm = useCallback(async () => {
    if (pendingMode) {
      await changeMode(pendingMode);
      setPendingMode(null);
    }
  }, [pendingMode, changeMode]);

  const confirmInfo = pendingMode ? confirmMessages[pendingMode] : null;

  return (
    <>
      <Card padding="md" className="flex flex-col gap-kb-md">
        <h2 className="text-b1 font-semibold text-text-primary">同步模式</h2>

        <div className="grid grid-cols-3 gap-3">
          {modeOptions.map(({ modeKey, label, desc, icon: Icon }) => (
            <button
              key={modeKey}
              onClick={() => handleModeClick(modeKey)}
              className={cn(
                'flex flex-col items-start gap-2 p-4 rounded-kb-lg',
                'border-2 transition-all duration-kb-normal',
                'hover:-translate-y-0.5',
                mode === modeKey
                  ? 'border-brand-500 bg-brand-50 shadow-kb-sm'
                  : 'border-border/50 bg-bg-elevated hover:border-brand-300',
              )}
            >
              <div className={cn(
                'w-9 h-9 rounded-kb-md flex items-center justify-center',
                mode === modeKey ? 'bg-brand-100 text-brand-600' : 'bg-bg-tertiary text-text-secondary',
              )}>
                <Icon className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="text-left">
                <p className={cn(
                  'text-b2 font-medium',
                  mode === modeKey ? 'text-brand-700' : 'text-text-primary',
                )}>
                  {label}
                </p>
                <p className="text-c1 text-text-tertiary mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* 推荐模式提示 */}
        {recommendedMode !== mode && (
          <div className={cn(
            'flex items-start gap-2.5 p-3 rounded-kb-md',
            'bg-semantic-info/5 border border-semantic-info/20',
          )}>
            <Lightbulb className="w-icon-sm h-icon-sm text-semantic-info flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-b3 text-text-secondary">
                根据当前状态，推荐使用{' '}
                <span className="font-medium text-semantic-info">
                  {modeOptions.find(m => m.modeKey === recommendedMode)?.label}
                </span>
              </p>
              <button
                onClick={() => handleModeClick(recommendedMode)}
                className="text-c1 text-brand-600 hover:underline mt-0.5"
              >
                一键切换
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* 模式切换确认对话框 */}
      <Modal
        open={!!pendingMode && !!confirmInfo}
        onClose={() => setPendingMode(null)}
        title={confirmInfo?.title || ''}
        description={confirmInfo?.description || ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingMode(null)}>
              取消
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              确认切换
            </Button>
          </>
        }
      >
        <p className="text-b2 text-text-secondary">
          切换后数据将按新模式进行管理，你可以在设置中随时更改。
        </p>
      </Modal>
    </>
  );
}
