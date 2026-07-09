import { Sun, Moon, Wifi, WifiOff, Signal, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSync } from '@/lib/sync/SyncContext';
import { cn } from '@/lib/utils';

function formatLastSync(date: Date | null): string {
  if (!date) return '从未同步';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return '刚刚同步';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return date.toLocaleDateString();
}

const networkStatusConfig = {
  online: { color: 'bg-semantic-success', label: '在线', icon: Wifi, iconColor: 'text-text-secondary' },
  weak: { color: 'bg-semantic-warning', label: '弱网', icon: Signal, iconColor: 'text-semantic-warning' },
  offline: { color: 'bg-semantic-danger', label: '离线', icon: WifiOff, iconColor: 'text-text-tertiary' },
} as const;

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const pageTitle = usePageTitle();
  const { status: netStatus } = useNetworkStatus();
  const { isSyncing, lastSyncAt, pendingCount } = useSync();

  const netConfig = networkStatusConfig[netStatus];
  const NetIcon = netConfig.icon;

  return (
    <header
      className={cn(
        'sticky top-0 z-20',
        'bg-bg-primary/80 backdrop-blur-md',
        'border-b border-border/30',
        'h-14 flex items-center justify-between px-kb-lg',
      )}
    >
      {/* Left: Page title */}
      <h1 className="text-h3 font-semibold text-text-primary truncate">
        {pageTitle}
      </h1>

      {/* Right: Sync + Network + Theme toggle */}
      <div className="flex items-center gap-kb-md">
        {/* Sync status */}
        <div
          className="flex items-center gap-kb-xs text-caption text-text-tertiary"
          title={
            isSyncing
              ? '正在同步...'
              : pendingCount > 0
                ? `${pendingCount} 项待同步`
                : formatLastSync(lastSyncAt)
          }
        >
          {isSyncing ? (
            <RefreshCw className="w-icon-xs h-icon-xs animate-spin text-semantic-info" />
          ) : pendingCount > 0 ? (
            <span className="text-caption text-semantic-warning">{pendingCount}</span>
          ) : (
            <CheckCircle2 className="w-icon-xs h-icon-xs text-semantic-success" />
          )}
        </div>

        {/* Network status */}
        <div className="flex items-center gap-kb-xs" title={netConfig.label}>
          <NetIcon className={cn('w-icon-sm h-icon-sm', netConfig.iconColor)} />
          <span className={cn('w-2 h-2 rounded-kb-full', netConfig.color)} />
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            'p-kb-xs rounded-kb-md',
            'text-text-secondary hover:text-text-primary',
            'hover:bg-bg-secondary',
            'transition-all duration-kb-normal ease-kb-default',
            'active:scale-95',
          )}
          aria-label="切换主题"
        >
          {theme === 'light' ? (
            <Moon className="w-icon-md h-icon-md" />
          ) : (
            <Sun className="w-icon-md h-icon-md" />
          )}
        </button>
      </div>
    </header>
  );
}
