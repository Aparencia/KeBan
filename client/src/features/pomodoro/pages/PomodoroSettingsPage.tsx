import { useState, useEffect } from 'react';
import { Timer, Zap, Bell, Save, RotateCcw, GraduationCap } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { usePomodoroStore } from '../store/usePomodoroStore';

const DEFAULT_SETTINGS = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  autoStartBreak: true,
  autoStartWork: false,
  soundEnabled: true,
  notificationEnabled: false,
  classDuration: 45,
};

// Toggle switch component
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'relative w-11 h-6 rounded-kb-full transition-colors duration-kb-fast ease-kb-default',
        'flex-shrink-0',
        'hover:scale-[1.02] active:scale-[0.98]',
        checked ? 'bg-brand-600' : 'bg-bg-tertiary border border-border/50',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-kb-full bg-white shadow-kb-sm',
          'transition-transform duration-kb-fast ease-kb-default',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}

// Setting row helper
function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-kb-sm">
      <div className="flex-1 min-w-0">
        <p className="text-b2 font-medium text-text-primary">{label}</p>
        {description && (
          <p className="text-c1 text-text-tertiary mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0 ml-kb-md">{children}</div>
    </div>
  );
}

export default function PomodoroSettingsPage() {
  const { settings, updateSettings, initialize, mode } = usePomodoroStore();

  // Local form state (mirrors store settings)
  const [localSettings, setLocalSettings] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Sync local state when store settings change (e.g. after initialize resolves)
  useEffect(() => {
    setLocalSettings({ ...settings });
  }, [settings]);

  const handleDurationChange = (key: string, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0 && num <= 180) {
      setLocalSettings((prev) => ({ ...prev, [key]: num }));
    } else if (value === '' || value === '0') {
      setLocalSettings((prev) => ({ ...prev, [key]: 0 }));
    }
  };

  const handleToggle = (key: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      [key]: !(prev as Record<string, unknown>)[key],
    }));
  };

  const handleSave = () => {
    updateSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    updateSettings(DEFAULT_SETTINGS);
    setLocalSettings({ ...DEFAULT_SETTINGS });
    setResetDone(true);
    setTimeout(() => setResetDone(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto px-kb-md py-kb-lg">
      <h1 className="text-h1 font-semibold text-text-primary mb-kb-lg">番茄钟设置</h1>

      {/* Duration settings */}
      <Card variant="default" padding="lg" className="mb-kb-md">
        <div className="flex items-center gap-2 mb-kb-md">
          <Timer className="w-icon-sm h-icon-sm text-pomodoro" strokeWidth={1.5} />
          <h2 className="text-h3 font-medium text-text-primary">时长设置</h2>
        </div>

        <div className="space-y-kb-md">
          <Input
            label="工作时长（自习模式）"
            type="number"
            value={String(localSettings.workDuration)}
            onChange={(e) => handleDurationChange('workDuration', e.target.value)}
            min={1}
            max={180}
            suffix={<span className="text-text-tertiary text-b3">分钟</span>}
          />
          <Input
            label="短休息"
            type="number"
            value={String(localSettings.shortBreakDuration)}
            onChange={(e) => handleDurationChange('shortBreakDuration', e.target.value)}
            min={1}
            max={60}
            suffix={<span className="text-text-tertiary text-b3">分钟</span>}
          />
          <Input
            label="长休息"
            type="number"
            value={String(localSettings.longBreakDuration)}
            onChange={(e) => handleDurationChange('longBreakDuration', e.target.value)}
            min={1}
            max={60}
            suffix={<span className="text-text-tertiary text-b3">分钟</span>}
          />
          <Input
            label="长休息间隔"
            type="number"
            value={String(localSettings.longBreakInterval)}
            onChange={(e) => handleDurationChange('longBreakInterval', e.target.value)}
            min={1}
            max={12}
            suffix={<span className="text-text-tertiary text-b3">个番茄</span>}
          />
        </div>
      </Card>

      {/* Class mode settings */}
      <Card variant="default" padding="lg" className="mb-kb-md">
        <div className="flex items-center gap-2 mb-kb-md">
          <GraduationCap className="w-icon-sm h-icon-sm text-brand-600" strokeWidth={1.5} />
          <h2 className="text-h3 font-medium text-text-primary">上课模式设置</h2>
        </div>
        <p className="text-c1 text-text-tertiary mb-kb-md">
          上课模式下，使用固定课堂时长，课间自动短休，不进入长休息。
        </p>
        <div className="space-y-kb-md">
          <Input
            label="课堂时长"
            type="number"
            value={String(localSettings.classDuration)}
            onChange={(e) => handleDurationChange('classDuration', e.target.value)}
            min={10}
            max={120}
            suffix={<span className="text-text-tertiary text-b3">分钟</span>}
          />
        </div>
      </Card>

      {/* Automation settings */}
      <Card variant="default" padding="lg" className="mb-kb-md">
        <div className="flex items-center gap-2 mb-kb-sm">
          <Zap className="w-icon-sm h-icon-sm text-amber-500" strokeWidth={1.5} />
          <h2 className="text-h3 font-medium text-text-primary">自动化</h2>
        </div>

        <div className="divide-y divide-border/30">
          <SettingRow label="自动开始休息" description="工作结束后自动进入休息">
            <Toggle
              checked={localSettings.autoStartBreak}
              onChange={() => handleToggle('autoStartBreak')}
            />
          </SettingRow>
          <SettingRow label="自动开始下一个番茄" description="休息结束后自动开始工作">
            <Toggle
              checked={localSettings.autoStartWork}
              onChange={() => handleToggle('autoStartWork')}
            />
          </SettingRow>
        </div>
      </Card>

      {/* Notification settings */}
      <Card variant="default" padding="lg" className="mb-kb-xl">
        <div className="flex items-center gap-2 mb-kb-sm">
          <Bell className="w-icon-sm h-icon-sm text-brand-600" strokeWidth={1.5} />
          <h2 className="text-h3 font-medium text-text-primary">提醒方式</h2>
        </div>

        <div className="divide-y divide-border/30">
          <SettingRow label="声音提醒" description="阶段切换时播放提示音">
            <Toggle
              checked={localSettings.soundEnabled}
              onChange={() => handleToggle('soundEnabled')}
            />
          </SettingRow>
          <SettingRow label="浏览器通知" description="通过系统通知提醒阶段切换">
            <Toggle
              checked={localSettings.notificationEnabled}
              onChange={() => handleToggle('notificationEnabled')}
            />
          </SettingRow>
        </div>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-col gap-kb-sm">
        <Button
          variant="primary"
          size="lg"
          onClick={handleSave}
          icon={<Save className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
          className="w-full"
        >
          {saved ? '已保存 ✓' : '保存设置'}
        </Button>

        <Button
          variant="secondary"
          size="lg"
          onClick={handleReset}
          icon={<RotateCcw className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
          className="w-full"
        >
          {resetDone ? '已重置 ✓' : '重置为默认'}
        </Button>
      </div>
    </div>
  );
}
