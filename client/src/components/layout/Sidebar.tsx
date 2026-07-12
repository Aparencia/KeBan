import { useState, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Timer, FileText, Layers, Lightbulb, Settings,
  MessageSquare, Clapperboard, BarChart3, Sparkles,
  Sun, Moon, ChevronRight, ChevronLeft, User as UserIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/useSidebarStore';
import { useCaptureStore } from '@/stores/useCaptureStore';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import FeedbackPanel from './FeedbackPanel';

/* ── 导航配置 ── */
const navSection1 = [
  { to: '/', label: '首页', icon: Home, shortcut: '⌘ 1', exact: true },
];

const navSection2 = [
  { to: '/pomodoro', label: '番茄钟', icon: Timer, shortcut: '⌘ 2', dotColor: 'bg-brand-500' },
  { to: '/notes', label: '笔记', icon: FileText, shortcut: '⌘ 3', dotColor: 'bg-note' },
  { to: '/flashcards', label: '闪卡', icon: Layers, shortcut: '⌘ 4', dotColor: 'bg-flashcard' },
  { to: '/feynman', label: '费曼技巧', icon: Lightbulb, shortcut: '⌘ 5', dotColor: 'bg-feynman' },
];

const navSection3 = [
  { to: '/analytics', label: '数据分析', icon: BarChart3, shortcut: '⌘ 6' },
  { to: '/inspiration', label: '灵感', icon: Sparkles, shortcut: '⌘ 7' },
];

/* ── 蔡格尼克效应：待继续任务提示池 ── */
const ghostTaskPool = [
  '上次的笔记还没整理完…',
  '今天开始学习了吗？',
  '还有几组卡片在等你复习…',
  '昨天标记的错题可以回顾一下了…',
  '上次学到哪了？继续吧…',
  '今天的第一个番茄钟还没开始…',
  '知识脉络还差一点就理清了…',
  '灵感一闪而过，记下来了吗…',
];

// 从池中随机取 N 条
function pickRandom<T>(pool: T[], count: number): T[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/* ── 动画 variants ── */
const sidebarItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.03, duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

export default function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const captureOpen = useCaptureStore((s) => s.open);
  const setCaptureOpen = useCaptureStore((s) => s.setOpen);
  const { user, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // TODO: 接入真实学习进度数据
  const progressItems: { subject: string; progress: number }[] = [];
  const ghostTasks = useMemo<string[]>(() => pickRandom(ghostTaskPool, 2), []);

  const isOnNotes = location.pathname.startsWith('/notes');

  const handleCaptureClick = () => {
    if (!isOnNotes) navigate('/notes');
    setCaptureOpen(true);
  };

  const meta = user?.user_metadata as Record<string, unknown> | undefined;
  const displayName = (meta?.['display_name'] as string) || (meta?.['full_name'] as string) || user?.email?.split('@')[0] || '未登录';
  const avatarUrl = meta?.['avatar_url'] as string | undefined;
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <>
      <aside
        className={cn(
          'hidden md:flex flex-col flex-shrink-0',
          'bg-bg-primary/80 backdrop-blur-2xl border-r border-border/40',
          'h-full sticky top-0 z-50',
          'transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
          collapsed ? 'w-14' : 'w-[240px]',
        )}
      >
        {/* ── 用户信息 ── */}
        <div className={cn(
          'flex items-center gap-2.5 px-4 h-12 flex-shrink-0',
          collapsed && 'justify-center px-0',
        )}>
          {isAuthenticated && user ? (
            <>
              {avatarUrl ? (
                <motion.img
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  src={avatarUrl} alt={displayName}
                  className="w-7 h-7 rounded-full flex-shrink-0 object-cover border-2 border-brand-200/50 shadow-sm"
                />
              ) : (
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200 border border-brand-200/50 text-brand-600 text-[11px] font-semibold shadow-sm"
                >
                  {avatarLetter}
                </motion.div>
              )}
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn('text-[13px] font-medium text-text-primary truncate', collapsed && 'hidden')}
              >
                {displayName}
              </motion.span>
            </>
          ) : (
            <>
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-bg-secondary text-text-tertiary">
                <UserIcon className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <span className={cn('text-[13px] font-medium text-text-tertiary', collapsed && 'hidden')}>
                未登录
              </span>
            </>
          )}
        </div>

        {/* ── 导航区 ── */}
        <nav className="flex-1 px-2 overflow-y-auto overflow-x-hidden">
          {/* Section: 导航 */}
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 0.1 }}
              className="text-[10px] text-text-tertiary font-medium tracking-[0.08em] uppercase px-2.5 pt-3 pb-1"
            >
              导航
            </motion.div>
          )}
          {navSection1.map(({ to, label, icon: Icon, shortcut, exact }, i) => (
            <SidebarItem
              key={to} to={to} label={label} icon={Icon}
              shortcut={collapsed ? undefined : shortcut}
              collapsed={collapsed} end={exact} index={i}
            />
          ))}

          {/* Section: 学习 */}
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 0.15 }}
              className="text-[10px] text-text-tertiary font-medium tracking-[0.08em] uppercase px-2.5 pt-4 pb-1"
            >
              学习
            </motion.div>
          )}
          {collapsed && <div className="my-1 mx-1.5 border-t border-border/30" />}
          {navSection2.map(({ to, label, icon: Icon, shortcut, dotColor }, i) => (
            <SidebarItem
              key={to} to={to} label={label} icon={Icon}
              shortcut={collapsed ? undefined : shortcut}
              dotColor={dotColor} collapsed={collapsed} index={i + 1}
            />
          ))}

          {/* 课堂助手 */}
          <motion.button
            custom={5}
            variants={sidebarItemVariants}
            initial="hidden"
            animate="visible"
            onClick={handleCaptureClick}
            title={collapsed ? '课堂助手' : undefined}
            className={cn(
              'flex items-center gap-2 w-full rounded-[var(--kb-radius-sm)] transition-all duration-200',
              collapsed ? 'justify-center px-0 py-1.5 mx-0' : 'px-2.5 py-[7px]',
              captureOpen && isOnNotes
                ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                : 'text-text-secondary hover:text-text-primary hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
            )}
          >
            <Clapperboard className="w-[18px] h-[18px] flex-shrink-0 opacity-60" strokeWidth={1.5} />
            {!collapsed && <span className="text-[13px] flex-1 text-left">课堂助手</span>}
          </motion.button>

          {/* Section: 更多 */}
          {!collapsed && (
            <div className="text-[10px] text-text-tertiary font-medium tracking-[0.08em] uppercase px-2.5 pt-4 pb-1 opacity-60">
              更多
            </div>
          )}
          {collapsed && <div className="my-1 mx-1.5 border-t border-border/30" />}
          {navSection3.map(({ to, label, icon: Icon, shortcut }, i) => (
            <SidebarItem
              key={to} to={to} label={label} icon={Icon}
              shortcut={collapsed ? undefined : shortcut}
              collapsed={collapsed} index={i + 6}
            />
          ))}

          {/* Ghost Tasks — Zeigarnik Effect */}
          {!collapsed && (
            <>
              <div className="text-[10px] text-text-tertiary font-medium tracking-[0.08em] uppercase px-2.5 pt-5 pb-1 opacity-60">
                待继续
              </div>
              {ghostTasks.map((task, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="flex items-center gap-2 px-3 py-[5px] cursor-default group/ghost"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-400/40 flex-shrink-0 animate-pulse" />
                  <span className="text-[11px] text-text-tertiary/60 truncate group-hover/ghost:text-text-secondary transition-colors duration-200 italic">
                    {task}
                  </span>
                </motion.div>
              ))}
            </>
          )}
        </nav>

        {/* ── 底部区域 ── */}
        <div className={cn(
          'border-t border-border/30 flex-shrink-0',
          collapsed ? 'px-1 py-2' : 'px-3 py-2.5',
        )}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={toggleTheme}
                className="w-7 h-7 flex items-center justify-center rounded-[4px] text-text-secondary hover:text-text-primary hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors duration-200 active:scale-90"
                title="切换主题"
              >
                {theme === 'light' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={toggle}
                className="w-7 h-7 flex items-center justify-center rounded-[4px] text-text-secondary hover:text-text-primary hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors duration-200 active:scale-90"
                title="展开侧边栏"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <button
                onClick={toggleTheme}
                className="flex items-center gap-1.5 text-[11px] text-text-tertiary px-2 py-1 rounded-[4px] hover:text-text-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-all duration-200 active:scale-95 whitespace-nowrap"
              >
                {theme === 'light' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                主题
              </button>
              <button
                onClick={() => setFeedbackOpen(true)}
                className="flex items-center gap-1.5 text-[11px] text-text-tertiary px-2 py-1 rounded-[4px] hover:text-text-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-all duration-200 active:scale-95 whitespace-nowrap"
              >
                <MessageSquare className="w-3 h-3" />
                反馈
              </button>
              <NavLink
                to="/settings"
                className={({ isActive }) => cn(
                  'flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-[4px] transition-all duration-200 ml-auto active:scale-95 whitespace-nowrap',
                  isActive
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                )}
              >
                <Settings className="w-3 h-3" />
                设置
              </NavLink>
              <button
                onClick={toggle}
                className="w-6 h-6 flex items-center justify-center rounded-[4px] text-text-secondary hover:text-text-primary hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors duration-200 active:scale-90"
                title="收起侧边栏"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <FeedbackPanel isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}

/* ── SidebarItem 子组件 ── */
interface SidebarItemProps {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
  shortcut?: string;
  dotColor?: string;
  collapsed: boolean;
  end?: boolean;
  index?: number;
}

function SidebarItem({ to, label, icon: Icon, shortcut, dotColor, collapsed, end, index = 0 }: SidebarItemProps) {
  return (
    <motion.div
      custom={index}
      variants={sidebarItemVariants}
      initial="hidden"
      animate="visible"
    >
      <NavLink
        to={to}
        end={end}
        title={collapsed ? label : undefined}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 rounded-[var(--kb-radius-sm)] relative transition-all duration-200 group',
            collapsed ? 'justify-center px-0 py-1.5 mx-0' : 'px-2.5 py-[7px]',
            isActive
              ? 'bg-brand-50/80 text-brand-600 font-medium dark:bg-brand-900/15 dark:text-brand-400 shadow-[inset_0_0_0_1px_rgba(91,138,114,0.1)]'
              : 'text-text-secondary hover:text-text-primary hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
          )
        }
      >
        {({ isActive }) => (
          <>
            {/* Active 指示器 — 2px 绿色竖线 + 发光 */}
            {isActive && (
              <motion.span
                layoutId="sidebar-active-indicator"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-brand-500 rounded-[1px] shadow-[0_0_6px_rgba(91,138,114,0.4)]"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <span className="w-[18px] h-[18px] flex items-center justify-center flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
              <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </span>
            {/* 模块色点 */}
            {dotColor && !collapsed && (
              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity duration-200', dotColor)} />
            )}
            {!collapsed && <span className="text-[13px] flex-1 truncate">{label}</span>}
            {/* 快捷键提示 — hover 显示 */}
            {shortcut && !collapsed && (
              <kbd className="text-[10px] text-text-tertiary/60 bg-bg-secondary/50 px-1.5 py-0.5 rounded-[3px] font-mono opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-0.5 group-hover:translate-y-0">
                {shortcut}
              </kbd>
            )}
          </>
        )}
      </NavLink>
    </motion.div>
  );
}
