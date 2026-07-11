import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Timer, FileText, Layers, Lightbulb, Settings, ChevronLeft, ChevronRight, MessageSquare, Clapperboard, BarChart3, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/useSidebarStore';
import { useCaptureStore } from '@/stores/useCaptureStore';
import FeedbackPanel from './FeedbackPanel';

const navItems = [
  { to: '/pomodoro', label: '番茄钟', icon: Timer },
  { to: '/notes', label: '笔记', icon: FileText },
  { to: '/flashcards', label: '闪卡', icon: Layers },
  { to: '/feynman', label: '费曼', icon: Lightbulb },
  { to: '/analytics', label: '效率分析', icon: BarChart3 },
  { to: '/inspiration', label: '灵感空间', icon: Sparkles },
];

export default function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const captureOpen = useCaptureStore((s) => s.open);
  const setCaptureOpen = useCaptureStore((s) => s.setOpen);

  const isOnNotes = location.pathname.startsWith('/notes');

  const handleCaptureClick = () => {
    if (!isOnNotes) {
      navigate('/notes');
    }
    setCaptureOpen(true);
  };

  return (
    <>
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
        <div className="w-7 h-7 rounded-kb-md bg-brand-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-c1 font-bold">课</span>
        </div>
        <span className={cn(
          'text-b1 font-semibold text-text-primary',
          collapsed && 'hidden',
        )}>
          课伴
        </span>
      </div>

      {/* Home — standalone, slightly larger */}
      <div className={cn('px-kb-sm pb-kb-xs', collapsed && 'px-1')}>
        <NavLink
          to="/"
          end
          title={collapsed ? '主页' : undefined}
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
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-600 rounded-kb-full" />
              )}
              <Home className="w-6 h-6 flex-shrink-0" strokeWidth={1.5} />
              <span className={cn(collapsed && 'hidden')}>主页</span>
            </>
          )}
        </NavLink>
      </div>

      {/* Divider */}
      <div className={cn('mx-kb-sm border-t border-border/30', collapsed && 'mx-1')} />

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

        {/* 课堂助手快捷入口 */}
        <button
          onClick={handleCaptureClick}
          title={collapsed ? '课堂助手' : undefined}
          className={cn(
            'flex items-center gap-kb-sm px-kb-md py-kb-sm rounded-kb-md w-full',
            'text-b2 transition-all duration-kb-normal ease-kb-default',
            'relative group',
            collapsed && 'justify-center px-0',
            captureOpen && isOnNotes
              ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary',
          )}
        >
          {captureOpen && isOnNotes && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-600 rounded-kb-full" />
          )}
          <Clapperboard className="w-icon-md h-icon-md flex-shrink-0" strokeWidth={1.5} />
          <span className={cn(collapsed && 'hidden')}>课堂助手</span>
        </button>
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

      {/* Feedback button */}
      <div className={cn(
        'px-kb-sm pt-kb-sm',
        collapsed && 'px-1',
      )}>
        <button
          onClick={() => setFeedbackOpen(true)}
          title={collapsed ? '反馈' : undefined}
          className={cn(
            'flex items-center gap-kb-sm px-kb-md py-kb-sm rounded-kb-md w-full',
            'text-b2 transition-all duration-kb-normal ease-kb-default',
            'text-text-secondary hover:text-text-primary hover:bg-bg-secondary',
            collapsed && 'justify-center px-0',
          )}
        >
          <MessageSquare className="w-icon-md h-icon-md flex-shrink-0" />
          <span className={cn(collapsed && 'hidden')}>反馈</span>
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
      <FeedbackPanel isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
