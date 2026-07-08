import { Sun, Moon, Wifi, WifiOff } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';

type NetworkStatus = 'online' | 'online-no-ai' | 'offline';

interface NavbarProps {
  networkStatus?: NetworkStatus;
}

const statusConfig: Record<NetworkStatus, { color: string; label: string }> = {
  online: { color: 'bg-semantic-success', label: '在线' },
  'online-no-ai': { color: 'bg-semantic-warning', label: '离线AI' },
  offline: { color: 'bg-text-tertiary', label: '离线' },
};

export default function Navbar({ networkStatus = 'online' }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const pageTitle = usePageTitle();
  const status = statusConfig[networkStatus];

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

      {/* Right: Status + Theme toggle */}
      <div className="flex items-center gap-kb-md">
        {/* Network status */}
        <div className="flex items-center gap-kb-xs" title={status.label}>
          {networkStatus === 'offline' ? (
            <WifiOff className="w-icon-sm h-icon-sm text-text-tertiary" />
          ) : (
            <Wifi className="w-icon-sm h-icon-sm text-text-secondary" />
          )}
          <span className={cn('w-2 h-2 rounded-kb-full', status.color)} />
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
