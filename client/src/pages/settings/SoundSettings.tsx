import { useState, useEffect } from 'react';
import { Card } from '@/components/ui';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { soundPlayer } from '@/lib/audio/SoundPlayer';

const SOUND_ENABLED_KEY = 'keban-sound-enabled';
const SOUND_VOLUME_KEY = 'keban-sound-volume';

/** 从 localStorage 读取音效偏好并初始化 SoundPlayer */
export function initSoundPreferences(): void {
  try {
    const enabled = localStorage.getItem(SOUND_ENABLED_KEY);
    const volume = localStorage.getItem(SOUND_VOLUME_KEY);
    if (enabled === 'false') {
      soundPlayer.setMuted(true);
    }
    if (volume !== null) {
      soundPlayer.setVolume(Number(volume) / 100);
    }
  } catch {
    // 静默降级
  }
}

export default function SoundSettings() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const v = localStorage.getItem(SOUND_ENABLED_KEY);
      return v !== 'false';
    } catch { return true; }
  });

  const [volume, setVolume] = useState(() => {
    try {
      const v = localStorage.getItem(SOUND_VOLUME_KEY);
      return v !== null ? Number(v) : 70;
    } catch { return 70; }
  });

  // 同步到 SoundPlayer 和 localStorage
  useEffect(() => {
    soundPlayer.setMuted(!enabled);
    try { localStorage.setItem(SOUND_ENABLED_KEY, String(enabled)); } catch { /* ignore */ }
  }, [enabled]);

  useEffect(() => {
    soundPlayer.setVolume(volume / 100);
    try { localStorage.setItem(SOUND_VOLUME_KEY, String(volume)); } catch { /* ignore */ }
  }, [volume]);

  return (
    <Card padding="md" className="flex flex-col gap-kb-md">
      <h2 className="text-b1 font-semibold text-text-primary">音效设置</h2>

      {/* 全局音效开关 */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <label className="text-b2 font-medium text-text-secondary">音效开关</label>
          <span className="text-c1 text-text-tertiary">开启后在操作触发时播放音效</span>
        </div>
        <button
          onClick={() => setEnabled((v) => !v)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-kb-full transition-colors duration-kb-fast',
            enabled ? 'bg-brand-500' : 'bg-bg-tertiary',
          )}
          aria-label="切换音效"
        >
          <span
            className={cn(
              'inline-block h-4 w-4 rounded-kb-full bg-white shadow-kb-sm transition-transform duration-kb-fast',
              enabled ? 'translate-x-6' : 'translate-x-1',
            )}
          />
        </button>
      </div>

      {/* 音量滑块 */}
      <div className="flex flex-col gap-kb-sm">
        <div className="flex items-center justify-between">
          <label className="text-b2 font-medium text-text-secondary">音量</label>
          <span className="text-b2 text-text-tertiary tabular-nums">{volume}%</span>
        </div>
        <div className="flex items-center gap-3">
          <VolumeX className="w-icon-sm h-icon-sm text-text-tertiary flex-shrink-0" strokeWidth={1.5} />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            disabled={!enabled}
            className={cn(
              'flex-1 h-1.5 rounded-kb-full appearance-none cursor-pointer',
              'bg-bg-tertiary',
              '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
              '[&::-webkit-slider-thumb]:rounded-kb-full [&::-webkit-slider-thumb]:bg-brand-500',
              '[&::-webkit-slider-thumb]:shadow-kb-sm [&::-webkit-slider-thumb]:cursor-pointer',
              !enabled && 'opacity-40 cursor-not-allowed',
            )}
          />
          <Volume2 className="w-icon-sm h-icon-sm text-text-tertiary flex-shrink-0" strokeWidth={1.5} />
        </div>
      </div>

      {/* 试听按钮 */}
      <button
        onClick={() => soundPlayer.play('pomodoro_start')}
        disabled={!enabled}
        className={cn(
          'self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-kb-md text-b2 font-medium',
          'bg-bg-secondary text-text-secondary border border-border/50',
          'hover:bg-bg-tertiary hover:text-text-primary',
          'active:scale-95 transition-all duration-kb-fast',
          !enabled && 'opacity-40 cursor-not-allowed',
        )}
      >
        试听音效
      </button>
    </Card>
  );
}
