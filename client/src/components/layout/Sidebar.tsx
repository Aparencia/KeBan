import { NavLink } from 'react-router-dom';
import { Timer, FileText, Layers, Lightbulb, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/pomodoro', label: '番茄钟', icon: Timer },
  { to: '/notes', label: '笔记', icon: FileText },
  { to: '/flashcards', label: '闪卡', icon: Layers },
  { to: '/feynman', label: '费曼', icon: Lightbulb },
];

export default function Sidebar() {
  return (
    <aside
      className={cn(
        'hidden md:flex flex-col',
        'w-60 flex-shrink-0',
        'bg-bg-elevated border-r border-border/50',
        'h-screen sticky top-0',
      )}
    >
      {/* Logo + Name */}
      <div className="flex items-center gap-kb-sm px-kb-lg h-14 flex-shrink-0">
        <div className="w-8 h-8 rounded-kb-md bg-brand-600 flex items-center justify-center">
          <span className="text-white text-b2 font-bold">课</span>
        </div>
        <span className="text-h3 font-semibold text-text-primary">课伴</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-kb-sm py-kb-md space-y-kb-xs">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-kb-sm px-kb-md py-kb-sm rounded-kb-md',
                'text-b2 transition-all duration-kb-normal ease-kb-default',
                'relative group',
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
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: Settings */}
      <div className="px-kb-sm pb-kb-md border-t border-border/30 pt-kb-sm">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-kb-sm px-kb-md py-kb-sm rounded-kb-md',
              'text-b2 transition-all duration-kb-normal ease-kb-default',
              'relative',
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
              <span>设置</span>
            </>
          )}
        </NavLink>
      </div>
    </aside>
  );
}
