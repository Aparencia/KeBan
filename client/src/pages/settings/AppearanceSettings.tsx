import { useState } from 'react';
import { Card } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { Sun, Moon, Rows3, Grid3x3, AlignJustify } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 密度存储 key */
const DENSITY_KEY = 'keban-density';

/** 密度类型 */
type Density = 'compact' | 'normal' | 'loose';

/** 从 localStorage 读取当前密度 */
function getStoredDensity(): Density {
  try {
    const v = localStorage.getItem(DENSITY_KEY);
    if (v === 'compact' || v === 'normal' || v === 'loose') return v;
  } catch { /* ignore */ }
  return 'normal';
}

/** 密度选项配置 */
const densityConfig: { key: Density; label: string; icon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number | string }> }[] = [
  { key: 'compact', label: '紧凑', icon: Rows3 },
  { key: 'normal', label: '标准', icon: Grid3x3 },
  { key: 'loose', label: '宽松', icon: AlignJustify },
];

export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [density, setDensity] = useState<Density>(getStoredDensity);

  const handleDensityChange = (key: Density) => {
    setDensity(key);
    try {
      localStorage.setItem(DENSITY_KEY, key);
    } catch { /* ignore */ }
    // 立即应用到 DOM
    document.documentElement.setAttribute('data-density', key);
  };

  return (
    <Card padding="md" className="flex flex-col gap-kb-md">
      <h2 className="text-b1 font-semibold text-text-primary">外观设置</h2>

      {/* 主题切换 */}
      <div className="flex flex-col gap-kb-sm">
        <label className="text-b2 font-medium text-text-secondary">主题模式</label>
        <div className="grid grid-cols-2 gap-3">
          {([
            { key: 'light' as const, label: '晨曦浮光', icon: Sun, desc: '清爽明亮，适合日间使用' },
            { key: 'dark' as const, label: '极夜深海', icon: Moon, desc: '护眼舒适，适合夜间使用' },
          ]).map(({ key, label, icon: Icon, desc }) => (
            <button
              key={key}
              onClick={() => setTheme(key)}
              className={cn(
                'flex flex-col items-start gap-2 p-4 rounded-kb-lg',
                'border-2 transition-all duration-kb-normal',
                'hover:-translate-y-0.5',
                theme === key
                  ? 'border-brand-500 bg-brand-50 shadow-kb-sm'
                  : 'border-border/50 bg-bg-elevated hover:border-brand-300',
              )}
            >
              <div className={cn(
                'w-9 h-9 rounded-kb-md flex items-center justify-center',
                theme === key ? 'bg-brand-100 text-brand-600' : 'bg-bg-tertiary text-text-secondary',
              )}>
                <Icon className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="text-left">
                <p className={cn(
                  'text-b2 font-medium',
                  theme === key ? 'text-brand-700' : 'text-text-primary',
                )}>
                  {label}
                </p>
                <p className="text-c1 text-text-tertiary mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 信息密度 */}
      <div className="flex flex-col gap-kb-sm">
        <label className="text-b2 font-medium text-text-secondary">信息密度</label>
        <div className="grid grid-cols-3 gap-2">
          {densityConfig.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleDensityChange(key)}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 px-3 rounded-kb-md',
                'border-2 text-b2 font-medium',
                'transition-all duration-kb-fast',
                density === key
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-border/50 bg-bg-elevated text-text-secondary hover:border-brand-300 hover:bg-bg-tertiary',
              )}
            >
              <Icon className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>

        {/* 密度预览 */}
        <div className="mt-3 rounded-kb-md border border-border/50 bg-bg-secondary overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30">
            <span className="text-b3 text-text-tertiary">预览效果</span>
          </div>
          <div className="space-y-0">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-2 border-b border-border/20 last:border-0"
                style={{
                  padding: density === 'compact' ? '6px 12px' : density === 'loose' ? '16px 12px' : '10px 12px',
                }}
              >
                <div className="w-8 h-8 rounded-kb-sm bg-brand-100 dark:bg-brand-900/30 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-b2 font-medium text-text-primary truncate">笔记标题 {i}</div>
                  <div className="text-b3 text-text-secondary truncate">这是笔记内容的预览文本...</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <span className="px-1.5 py-0.5 text-b3 rounded text-brand-600 bg-brand-50">标签</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
