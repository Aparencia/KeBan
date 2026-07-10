import { useState, useEffect, useRef } from 'react';
import { Card, Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/components/ui/Toast';
import { useMode } from '@/hooks/useMode';
import type { AppMode } from '@/lib/mode/ModeManager';
import { Sun, Moon, Download, Upload, HardDrive, Shield, Info, Rows3, Grid3x3, AlignJustify, Cloud, Globe, Lightbulb, Eye, EyeOff, Cpu, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  exportAllData,
  downloadExport,
  importData,
  readFileAsText,
  getStorageInfo,
} from '@/lib/storage';
import type { StorageInfo } from '@/lib/storage';
import { getAIConfig, saveAIConfig, updateAIGatewayUrl } from '@/lib/ai/config';
import type { AIConfig } from '@/lib/ai/config';
import { saveUserKeys, getUserKeys, clearUserKeys } from '@/lib/ai/apiKeyManager';
import type { AIProviderKeys } from '@/lib/ai/apiKeyManager';

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

const modeOptions: { key: AppMode; label: string; desc: string; icon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number | string }> }[] = [
  { key: 'local', label: '本地优先', desc: '数据仅存储在本地，不启用云同步', icon: HardDrive },
  { key: 'hybrid', label: '混合模式', desc: '本地存储 + 云端备份，离线时自动排队', icon: Cloud },
  { key: 'full', label: '完全云端', desc: '数据实时同步到云端，多设备共享', icon: Globe },
];

const providerOptions: { key: AIConfig['provider']; label: string }[] = [
  { key: 'qwen', label: '通义千问（Qwen）' },
  { key: 'deepseek', label: '深度求索（DeepSeek）' },
  { key: 'glm', label: '智谱清言（GLM）' },
  { key: 'custom', label: '自定义' },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { mode, changeMode, recommendedMode } = useMode();
  const [density, setDensity] = useState<Density>(getStoredDensity);

  // AI 配置状态
  const [aiConfig, setAIConfig] = useState<AIConfig>(getAIConfig);
  const [showApiKey, setShowApiKey] = useState(false);

  // 用户自配置 API Key 状态
  const [userKeys, setUserKeys] = useState<AIProviderKeys>(getUserKeys);
  const [showUserKey, setShowUserKey] = useState<Record<string, boolean>>({});

  const handleAIConfigSave = () => {
    saveAIConfig(aiConfig);
    updateAIGatewayUrl(aiConfig.gatewayUrl);
    toast({ type: 'success', message: 'AI 配置已保存' });
  };

  const handleUserKeysSave = () => {
    saveUserKeys(userKeys);
    toast({ type: 'success', message: 'API Key 配置已保存' });
  };

  const handleUserKeysClear = () => {
    clearUserKeys();
    setUserKeys({});
    toast({ type: 'success', message: 'API Key 已清除' });
  };

  const toggleUserKeyVisibility = (provider: string) => {
    setShowUserKey(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

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

        {/* ── 同步模式 ── */}
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

        {/* ── AI 服务配置 ── */}
        <Card padding="md" className="flex flex-col gap-kb-md">
          <h2 className="text-b1 font-semibold text-text-primary">AI 服务配置</h2>

          {/* Provider 选择 */}
          <div className="flex flex-col gap-kb-sm">
            <label className="text-b2 font-medium text-text-secondary">AI 提供商</label>
            <select
              value={aiConfig.provider}
              onChange={(e) => setAIConfig({ ...aiConfig, provider: e.target.value as AIConfig['provider'] })}
              className={cn(
                'w-full px-3 py-2 rounded-kb-md text-b2',
                'bg-bg-elevated border-2 border-border/50 text-text-primary',
                'focus:outline-none focus:border-brand-500',
                'transition-colors duration-kb-fast',
              )}
            >
              {providerOptions.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-kb-sm">
            <label className="text-b2 font-medium text-text-secondary">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={aiConfig.apiKey}
                onChange={(e) => setAIConfig({ ...aiConfig, apiKey: e.target.value })}
                placeholder="请输入 API Key"
                className={cn(
                  'w-full px-3 py-2 pr-10 rounded-kb-md text-b2',
                  'bg-bg-elevated border-2 border-border/50 text-text-primary',
                  'placeholder:text-text-quaternary',
                  'focus:outline-none focus:border-brand-500',
                  'transition-colors duration-kb-fast',
                )}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                tabIndex={-1}
              >
                {showApiKey
                  ? <EyeOff className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
                  : <Eye className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          {/* Gateway URL */}
          <div className="flex flex-col gap-kb-sm">
            <label className="text-b2 font-medium text-text-secondary">Gateway URL</label>
            <input
              type="text"
              value={aiConfig.gatewayUrl}
              onChange={(e) => setAIConfig({ ...aiConfig, gatewayUrl: e.target.value })}
              placeholder="http://localhost:8000"
              className={cn(
                'w-full px-3 py-2 rounded-kb-md text-b2',
                'bg-bg-elevated border-2 border-border/50 text-text-primary',
                'placeholder:text-text-quaternary',
                'focus:outline-none focus:border-brand-500',
                'transition-colors duration-kb-fast',
              )}
            />
          </div>

          {/* 保存按钮 */}
          <Button
            variant="primary"
            size="md"
            icon={<Cpu className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
            className="w-full"
            onClick={handleAIConfigSave}
          >
            保存 AI 配置
          </Button>
        </Card>

        {/* ── AI 模型配置（用户自配 Key） ── */}
        <Card padding="md" className="flex flex-col gap-kb-md">
          <div className="flex items-start gap-3">
            <div className={cn(
              'w-9 h-9 rounded-kb-md flex items-center justify-center flex-shrink-0',
              'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
            )}>
              <Key className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-b1 font-semibold text-text-primary">AI 模型配置</h2>
              <p className="text-c1 text-text-tertiary mt-0.5 leading-relaxed">
                您可以配置自己的 API Key 以使用更多 AI 模型。系统默认模型由后端代理转发，无需担心安全问题。
              </p>
            </div>
          </div>

          {/* Provider Key 输入框组 */}
          {([
            { key: 'glm' as const, label: 'GLM（智谱）API Key', placeholder: '请输入智谱 API Key' },
            { key: 'qwen' as const, label: 'Qwen（通义千问）API Key', placeholder: '请输入通义千问 API Key' },
            { key: 'deepseek' as const, label: 'DeepSeek API Key', placeholder: '请输入 DeepSeek API Key' },
          ]).map(({ key, label, placeholder }) => (
            <div key={key} className="flex flex-col gap-kb-sm">
              <label className="text-b2 font-medium text-text-secondary">{label}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showUserKey[key] ? 'text' : 'password'}
                    value={userKeys[key] ?? ''}
                    onChange={(e) => setUserKeys(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={cn(
                      'w-full px-3 py-2 pr-10 rounded-kb-md text-b2',
                      'bg-bg-elevated border-2 border-border/50 text-text-primary',
                      'placeholder:text-text-quaternary',
                      'focus:outline-none focus:border-brand-500',
                      'transition-colors duration-kb-fast',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => toggleUserKeyVisibility(key)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                    tabIndex={-1}
                  >
                    {showUserKey[key]
                      ? <EyeOff className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
                      : <Eye className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-kb-sm">
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={handleUserKeysSave}
            >
              保存配置
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="flex-shrink-0"
              onClick={handleUserKeysClear}
            >
              清除
            </Button>
          </div>

          {/* 安全提示 */}
          <div className={cn(
            'flex items-start gap-2.5 p-3 rounded-kb-md',
            'bg-semantic-success/5 border border-semantic-success/20',
          )}>
            <Shield className="w-icon-sm h-icon-sm text-semantic-success flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-c1 text-text-secondary leading-relaxed">
              <span className="font-medium text-semantic-success">安全说明：</span>
              API Key 仅保存在您的本地浏览器中，不会上传到任何服务器。系统默认模型调用仍通过后端 ai-gateway 代理。
            </p>
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
              <p className="text-c1 text-text-tertiary">v0.3.0 · MVP-2 Alpha</p>
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
