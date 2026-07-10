import { NavLink } from 'react-router-dom';
import { Timer, FileText, Layers, Lightbulb, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/useSidebarStore';

const navItems = [
  { to: '/pomodoro', label: '番茄钟', icon: Timer },
  { to: '/notes', label: '笔记', icon: FileText },
  { to: '/flashcards', label: '闪卡', icon: Layers },
  { to: '/feynman', label: '费曼', icon: Lightbulb },
];

export default function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col',
        'flex-shrink-0',
        'bg-bg-elevated border-r border-border/50',
        'h-screen sticky top-0',
        'transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo + Name */}
      <div className={cn(
        'flex items-center gap-kb-sm px-kb-lg h-14 flex-shrink-0',
        collapsed && 'justify-center px-0',
      )}>
        <div className="w-8 h-8 rounded-kb-md bg-brand-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-b2 font-bold">课</span>
        </div>
        <span className={cn(
          'text-h3 font-semibold text-text-primary',
          collapsed && 'hidden',
        )}>
          课伴
        </span>
      </div>

      {/* Nav items */}
      <nav className={cn(
        'flex-1 px-kb-sm py-kb-md space-y-kb-xs',
        collapsed && 'px-1',
      )}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-kb-sm px-kb-md py-kb-sm rounded-kb-md',
                'text-b2 transition-all duration-kb-normal ease-kb-default',
                'relative group',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary',
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-600 rounded-kb-full" />
                )}
                <Icon className="w-icon-md h-icon-md flex-shrink-0" />
                <span className={cn(collapsed && 'hidden')}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle button */}
      <div className={cn(
        'px-kb-sm border-t border-border/30 pt-kb-sm',
        collapsed && 'px-1',
      )}>
        <button
          onClick={toggle}
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          className={cn(
            'flex items-center gap-kb-sm px-kb-md py-kb-sm rounded-kb-md w-full',
            'text-b2 transition-all duration-kb-normal ease-kb-default',
            'text-text-secondary hover:text-text-primary hover:bg-bg-secondary',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-icon-md h-icon-md flex-shrink-0" />
          ) : (
            <>
              <ChevronLeft className="w-icon-md h-icon-md flex-shrink-0" />
              <span>收起</span>
            </>
          )}
        </button>
      </div>

      {/* Bottom: Settings */}
      <div className={cn(
        'px-kb-sm pb-kb-md pt-kb-sm',
        collapsed && 'px-1',
      )}>
        <NavLink
          to="/settings"
          title={collapsed ? '设置' : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-kb-sm px-kb-md py-kb-sm rounded-kb-md',
              'text-b2 transition-all duration-kb-normal ease-kb-default',
              'relative',
              collapsed && 'justify-center px-0',
              isActive
                ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-600 rounded-kb-full" />
              )}
              <Settings className="w-icon-md h-icon-md flex-shrink-0" />
              <span className={cn(collapsed && 'hidden')}>设置</span>
            </>
          )}
        </NavLink>
      </div>
    </aside>
  );
}
