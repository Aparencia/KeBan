import { useState, useEffect, useRef } from 'react';
import { Card, Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/components/ui/Toast';
import { Sun, Moon, Download, Upload, HardDrive, Shield, Info, Rows3, Grid3x3, AlignJustify } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  exportAllData,
  downloadExport,
  importData,
  readFileAsText,
  getStorageInfo,
} from '@/lib/storage';
import type { StorageInfo } from '@/lib/storage';

const DENSITY_KEY = 'keban-density';

type Density = 'compact' | 'normal' | 'loose';

function getStoredDensity(): Density {
  try {
    const v = localStorage.getItem(DENSITY_KEY);
    if (v === 'compact' || v === 'normal' || v === 'loose') return v;
  } catch { /* ignore */ }
  return 'normal';
}

const densityConfig: { key: Density; label: string; icon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number | string }> }[] = [
  { key: 'compact', label: '紧凑', icon: Rows3 },
  { key: 'normal', label: '标准', icon: Grid3x3 },
  { key: 'loose', label: '宽松', icon: AlignJustify },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [density, setDensity] = useState<Density>(getStoredDensity);

  const handleDensityChange = (key: Density) => {
    setDensity(key);
    try {
      localStorage.setItem(DENSITY_KEY, key);
    } catch { /* ignore */ }
    // 立即应用到 DOM
    document.documentElement.setAttribute('data-density', key);
  };
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getStorageInfo().then((info) => {
      if (info) setStorageInfo(info);
    });
  }, []);

  const handleExport = async () => {
    try {
      setExporting(true);
      const json = await exportAllData();
      downloadExport(json);
      toast({ type: 'success', message: '数据导出成功' });
    } catch {
      toast({ type: 'error', message: '导出失败，请重试' });
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 重置 input 以便同一文件可以再次选择
    e.target.value = '';

    try {
      setImporting(true);
      const text = await readFileAsText(file);
      const result = await importData(text);
      if (result.success) {
        toast({ type: 'success', message: result.message });
        // 刷新页面以加载新数据
        setTimeout(() => window.location.reload(), 800);
      } else {
        toast({ type: 'error', message: result.message });
      }
    } catch {
      toast({ type: 'error', message: '导入失败，请检查文件格式' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-kb-md py-kb-md">
        <h1 className="text-h1 font-semibold text-text-primary">设置</h1>
        <p className="text-b2 text-text-tertiary mt-0.5">个性化你的学习体验</p>
      </div>

      <div className="flex-1 px-kb-md pb-kb-lg space-y-kb-md max-w-2xl w-full mx-auto">
        {/* ── 外观设置 ── */}
        <Card padding="md" className="flex flex-col gap-kb-md">
          <h2 className="text-b1 font-semibold text-text-primary">外观设置</h2>

          {/* 主题切换 */}
          <div className="flex flex-col gap-kb-sm">
            <label className="text-b2 font-medium text-text-secondary">主题模式</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'light' as const, label: '亮色模式', icon: Sun, desc: '清爽明亮，适合日间使用' },
                { key: 'dark' as const, label: '暗色模式', icon: Moon, desc: '护眼舒适，适合夜间使用' },
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
          </div>
        </Card>

        {/* ── 数据管理 ── */}
        <Card padding="md" className="flex flex-col gap-kb-md">
          <h2 className="text-b1 font-semibold text-text-primary">数据管理</h2>

          {/* 存储使用情况 */}
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-kb-md',
            'bg-bg-secondary border border-border/40',
          )}>
            <div className={cn(
              'w-9 h-9 rounded-kb-md flex items-center justify-center flex-shrink-0',
              'bg-brand-50 text-brand-500',
            )}>
              <HardDrive className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="text-b2 font-medium text-text-primary">本地存储</p>
              <p className="text-c1 text-text-tertiary">
                已使用{' '}
                <span className="text-brand-600 font-medium">
                  {storageInfo ? storageInfo.formatted.used : '—'}
                </span>
                {storageInfo && storageInfo.quota > 0
                  ? ` / ${storageInfo.formatted.quota}`
                  : ' / 不限'}
              </p>
            </div>
          </div>

          {/* 导出/导入 */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              size="md"
              icon={<Download className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
              className="w-full"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? '导出中…' : '导出数据'}
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<Upload className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
              className="w-full"
              onClick={handleImportClick}
              disabled={importing}
            >
              {importing ? '导入中…' : '导入数据'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </Card>

        {/* ── 关于 ── */}
        <Card padding="md" className="flex flex-col gap-kb-md">
          <h2 className="text-b1 font-semibold text-text-primary">关于</h2>

          <div className="flex items-center gap-3">
            <div className={cn(
              'w-11 h-11 rounded-kb-lg flex items-center justify-center flex-shrink-0',
              'bg-brand-600 text-white',
              'shadow-kb-sm',
            )}>
              <span className="text-b1 font-bold">课</span>
            </div>
            <div>
              <p className="text-b1 font-semibold text-text-primary">课伴</p>
              <p className="text-c1 text-text-tertiary">v0.1.0 · Beta 预览版</p>
            </div>
          </div>

          <div className={cn(
            'p-3 rounded-kb-md',
            'bg-bg-secondary border border-border/40',
          )}>
            <p className="text-b3 text-text-secondary leading-relaxed">
              <span className="font-medium text-brand-600">技术栈：</span>
              React 18 + TypeScript + Vite + TailwindCSS + IndexedDB
            </p>
          </div>

          <div className={cn(
            'flex items-start gap-2.5 p-3 rounded-kb-md',
            'bg-semantic-success/5 border border-semantic-success/20',
          )}>
            <Shield className="w-icon-sm h-icon-sm text-semantic-success flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-b3 text-text-secondary leading-relaxed">
              <span className="font-medium text-semantic-success">隐私优先：</span>
              本地优先架构，数据完全保存在您的设备上，不会上传至任何服务器。
            </p>
          </div>

          <div className={cn(
            'flex items-start gap-2.5 p-3 rounded-kb-md',
            'bg-bg-secondary border border-border/40',
          )}>
            <Info className="w-icon-sm h-icon-sm text-text-tertiary flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-c1 text-text-tertiary leading-relaxed">
              课伴是一款面向学生的本地优先学习工具，集成番茄钟、智能笔记、间隔重复闪卡和费曼学习法四大核心模块，
              帮助你建立科学高效的学习习惯。
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
