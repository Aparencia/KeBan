import { Card } from '@/components/ui';
import { useMode } from '@/hooks/useMode';
import type { AppMode } from '@/lib/mode/ModeManager';
import { HardDrive, Cloud, Globe, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 同步模式选项 */
const modeOptions: { key: AppMode; label: string; desc: string; icon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number | string }> }[] = [
  { key: 'local', label: '本地优先', desc: '数据仅存储在本地，不启用云同步', icon: HardDrive },
  { key: 'hybrid', label: '混合模式', desc: '本地存储 + 云端备份，离线时自动排队', icon: Cloud },
  { key: 'full', label: '完全云端', desc: '数据实时同步到云端，多设备共享', icon: Globe },
];

export default function SyncSettings() {
  const { mode, changeMode, recommendedMode } = useMode();

  return (
    <Card padding="md" className="flex flex-col gap-kb-md">
      <h2 className="text-b1 font-semibold text-text-primary">同步模式</h2>

      <div className="grid grid-cols-3 gap-3">
        {modeOptions.map(({ key, label, desc, icon: Icon }) => (
          <button
            key={key}
            onClick={() => changeMode(key)}
            className={cn(
              'flex flex-col items-start gap-2 p-4 rounded-kb-lg',
              'border-2 transition-all duration-kb-normal',
              'hover:-translate-y-0.5',
              mode === key
                ? 'border-brand-500 bg-brand-50 shadow-kb-sm'
                : 'border-border/50 bg-bg-elevated hover:border-brand-300',
            )}
          >
            <div className={cn(
              'w-9 h-9 rounded-kb-md flex items-center justify-center',
              mode === key ? 'bg-brand-100 text-brand-600' : 'bg-bg-tertiary text-text-secondary',
            )}>
              <Icon className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div className="text-left">
              <p className={cn(
                'text-b2 font-medium',
                mode === key ? 'text-brand-700' : 'text-text-primary',
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
                {modeOptions.find(m => m.key === recommendedMode)?.label}
              </span>
            </p>
            <button
              onClick={() => changeMode(recommendedMode)}
              className="text-c1 text-brand-600 hover:underline mt-0.5"
            >
              一键切换
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
