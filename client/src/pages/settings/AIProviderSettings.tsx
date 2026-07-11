import { useState } from 'react';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { Eye, EyeOff, Cpu, Key, Shield, ChevronDown, Loader2, CheckCircle, XCircle, Zap, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIConfig } from '@/lib/ai/config';
import { useSettingsStore } from '@/stores/useSettingsStore';

/** 模式预设方案 */
const modeOptions = [
  {
    key: 'standard',
    label: '标准模式',
    description: '使用免费模型（如 GLM-4-Flash），适合日常学习',
    icon: Zap,
    provider: 'glm' as AIConfig['provider'],
  },
  {
    key: 'advanced',
    label: '高级模式',
    description: '使用更强模型，适合深度分析和复杂任务',
    icon: Sparkles,
    provider: 'qwen' as AIConfig['provider'],
  },
] as const;

/** 用户自配 Key 输入框配置 */
const userKeyFields = [
  { key: 'glm' as const, label: 'GLM（智谱）API Key', placeholder: '请输入智谱 API Key' },
  { key: 'qwen' as const, label: 'Qwen（通义千问）API Key', placeholder: '请输入通义千问 API Key' },
  { key: 'deepseek' as const, label: 'DeepSeek API Key', placeholder: '请输入 DeepSeek API Key' },
];

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export default function AIProviderSettings() {
  const { toast } = useToast();

  const {
    aiConfig,
    showApiKey,
    userKeys,
    showUserKey,
    setAIConfig,
    toggleShowApiKey,
    setUserKeys,
    toggleUserKeyVisibility,
    saveAIConfigAction,
    saveUserKeysAction,
    clearUserKeysAction,
  } = useSettingsStore();

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');

  /** 当前模式推断：根据 provider 匹配 */
  const currentMode = modeOptions.find((m) => m.provider === aiConfig.provider) ?? modeOptions[0];

  /** 切换模式 */
  const handleModeChange = (modeKey: string) => {
    const mode = modeOptions.find((m) => m.key === modeKey);
    if (mode) {
      setAIConfig({ ...aiConfig, provider: mode.provider });
    }
  };

  /** 测试连接 */
  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');

    try {
      const gatewayUrl = aiConfig.gatewayUrl || 'http://121.40.24.242:8000';
      const response = await fetch(`${gatewayUrl}/docs`, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        setTestStatus('success');
        setTestMessage('连接成功，AI 服务可用');
      } else {
        setTestStatus('error');
        setTestMessage(`服务返回异常状态码：${response.status}`);
      }
    } catch (err) {
      setTestStatus('error');
      setTestMessage(err instanceof Error ? err.message : '连接失败，请检查网络或 Gateway URL');
    }
  };

  return (
    <>
      {/* ── AI 服务配置（简化版） ── */}
      <Card padding="md" className="flex flex-col gap-kb-md">
        <h2 className="text-b1 font-semibold text-text-primary">AI 服务配置</h2>

        {/* 模式选择 */}
        <div className="flex flex-col gap-kb-sm">
          <label className="text-b2 font-medium text-text-secondary">使用模式</label>
          <div className="grid grid-cols-2 gap-3">
            {modeOptions.map(({ key, label, description, icon: Icon, provider: _ }) => {
              const isActive = currentMode.key === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleModeChange(key)}
                  className={cn(
                    'flex flex-col items-start gap-1.5 p-3 rounded-kb-md text-left',
                    'border-2 transition-all duration-kb-fast',
                    isActive
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/10'
                      : 'border-border/50 bg-bg-elevated hover:border-border',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        'w-icon-sm h-icon-sm',
                        isActive ? 'text-brand-600' : 'text-text-tertiary',
                      )}
                      strokeWidth={1.5}
                    />
                    <span className={cn(
                      'text-b2 font-medium',
                      isActive ? 'text-brand-700 dark:text-brand-400' : 'text-text-primary',
                    )}>
                      {label}
                    </span>
                  </div>
                  <span className="text-c1 text-text-tertiary leading-relaxed">{description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* API Key — 显眼位置 */}
        <div className="flex flex-col gap-kb-sm">
          <label className="text-b2 font-medium text-text-secondary">API Key</label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={aiConfig.apiKey}
              onChange={(e) => setAIConfig({ ...aiConfig, apiKey: e.target.value })}
              placeholder="请输入 API Key"
              className={cn(
                'w-full px-3 py-2.5 pr-10 rounded-kb-md text-b2',
                'bg-bg-elevated border-2 border-border/50 text-text-primary',
                'placeholder:text-text-quaternary',
                'focus:outline-none focus:border-brand-500',
                'transition-colors duration-kb-fast',
              )}
            />
            <button
              type="button"
              onClick={toggleShowApiKey}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
              tabIndex={-1}
            >
              {showApiKey
                ? <EyeOff className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
                : <Eye className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {/* 保存 + 测试连接 */}
        <div className="flex gap-3">
          <Button
            variant="primary"
            size="md"
            icon={<Cpu className="w-icon-sm h-icon-sm" strokeWidth={1.5} />}
            className="flex-1"
            onClick={() => {
              saveAIConfigAction();
              toast({ type: 'success', message: 'AI 配置已保存' });
            }}
          >
            保存配置
          </Button>
          <Button
            variant="secondary"
            size="md"
            loading={testStatus === 'testing'}
            onClick={handleTestConnection}
          >
            测试连接
          </Button>
        </div>

        {/* 测试结果提示 */}
        {testStatus === 'success' && (
          <div className={cn(
            'flex items-center gap-2 p-2.5 rounded-kb-md',
            'bg-semantic-success/5 border border-semantic-success/20',
          )}>
            <CheckCircle className="w-icon-sm h-icon-sm text-semantic-success flex-shrink-0" strokeWidth={1.5} />
            <span className="text-b3 text-semantic-success">{testMessage}</span>
          </div>
        )}
        {testStatus === 'error' && (
          <div className={cn(
            'flex items-center gap-2 p-2.5 rounded-kb-md',
            'bg-semantic-error/5 border border-semantic-error/20',
          )}>
            <XCircle className="w-icon-sm h-icon-sm text-semantic-error flex-shrink-0" strokeWidth={1.5} />
            <span className="text-b3 text-semantic-error">{testMessage}</span>
          </div>
        )}
      </Card>

      {/* ── 高级设置（折叠面板） ── */}
      <Card padding="md" className="flex flex-col">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center justify-between w-full"
        >
          <h2 className="text-b1 font-semibold text-text-primary">高级设置</h2>
          <ChevronDown
            className={cn(
              'w-icon-sm h-icon-sm text-text-tertiary transition-transform duration-300',
              advancedOpen && 'rotate-180',
            )}
            strokeWidth={1.5}
          />
        </button>

        <div
          className={cn(
            'grid transition-all duration-300 ease-in-out',
            advancedOpen ? 'grid-rows-[1fr] opacity-100 mt-kb-md' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-kb-md">
              {/* Gateway URL */}
              <div className="flex flex-col gap-kb-sm">
                <label className="text-b2 font-medium text-text-secondary">自定义 Base URL</label>
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
                <span className="text-c1 text-text-quaternary">修改后需点击"保存配置"生效</span>
              </div>

              {/* AI 模型配置（用户自配 Key） */}
              <div className="flex flex-col gap-kb-sm">
                <div className="flex items-center gap-2">
                  <Key className="w-icon-sm h-icon-sm text-amber-500" strokeWidth={1.5} />
                  <span className="text-b2 font-medium text-text-secondary">自定义模型 API Key</span>
                </div>
                <p className="text-c1 text-text-tertiary leading-relaxed">
                  配置自己的 API Key 以使用更多模型。系统默认模型由后端代理转发，无需担心安全问题。
                </p>
              </div>

              {userKeyFields.map(({ key, label, placeholder }) => (
                <div key={key} className="flex flex-col gap-kb-sm">
                  <label className="text-b2 font-medium text-text-secondary">{label}</label>
                  <div className="relative">
                    <input
                      type={showUserKey[key] ? 'text' : 'password'}
                      value={userKeys[key] ?? ''}
                      onChange={(e) => setUserKeys((prev) => ({ ...prev, [key]: e.target.value }))}
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
              ))}

              {/* 操作按钮 */}
              <div className="flex gap-3 pt-kb-sm">
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  onClick={() => {
                    saveUserKeysAction();
                    toast({ type: 'success', message: 'API Key 配置已保存' });
                  }}
                >
                  保存 Key
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  className="flex-shrink-0"
                  onClick={() => {
                    clearUserKeysAction();
                    toast({ type: 'success', message: 'API Key 已清除' });
                  }}
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
                  API Key 仅保存在您的本地浏览器中，不会上传到任何服务器。
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
