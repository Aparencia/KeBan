import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { Eye, EyeOff, Cpu, Key, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIConfig } from '@/lib/ai/config';
import { useSettingsStore } from '@/stores/useSettingsStore';

/** AI 提供商选项 */
const providerOptions: { key: AIConfig['provider']; label: string }[] = [
  { key: 'qwen', label: '通义千问（Qwen）' },
  { key: 'deepseek', label: '深度求索（DeepSeek）' },
  { key: 'glm', label: '智谱清言（GLM）' },
  { key: 'custom', label: '自定义' },
];

/** 用户自配 Key 输入框配置 */
const userKeyFields = [
  { key: 'glm' as const, label: 'GLM（智谱）API Key', placeholder: '请输入智谱 API Key' },
  { key: 'qwen' as const, label: 'Qwen（通义千问）API Key', placeholder: '请输入通义千问 API Key' },
  { key: 'deepseek' as const, label: 'DeepSeek API Key', placeholder: '请输入 DeepSeek API Key' },
];

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

  return (
    <>
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
          onClick={() => {
            saveAIConfigAction();
            toast({ type: 'success', message: 'AI 配置已保存' });
          }}
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
        {userKeyFields.map(({ key, label, placeholder }) => (
          <div key={key} className="flex flex-col gap-kb-sm">
            <label className="text-b2 font-medium text-text-secondary">{label}</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
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
            保存配置
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
            API Key 仅保存在您的本地浏览器中，不会上传到任何服务器。系统默认模型调用仍通过后端 ai-gateway 代理。
          </p>
        </div>
      </Card>
    </>
  );
}
