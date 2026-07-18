import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import CommandPalette from '../ui/CommandPalette';
import { CloseConfirmDialog } from '../ui/CloseConfirmDialog';
import { CustomTitlebar } from './CustomTitlebar';
import BottomNav from './BottomNav';
import { useSessionExpiry } from '@/hooks/useSessionExpiry';
import { useSync } from '@/lib/sync/SyncContext';
import { SceneProvider } from '@/lib/3d/core/SceneProvider';
import { SceneTransition } from '@/lib/3d/scenes/SceneTransition';
import { SpatialNav } from '@/lib/3d/navigation/SpatialNav';
import { FunctionalOverlay } from '@/components/overlay/FunctionalOverlay';
import { useOrbitalStore } from '@/lib/3d/navigation/OrbitalStore';

export default function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isInModule, currentModule, exitModule, syncWithRoute } = useOrbitalStore();
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const { sync } = useSync();

  // 监听 session 过期事件
  useSessionExpiry();

  // 路由 → 3D状态同步（刷新页面或直接URL访问时恢复状态）
  useEffect(() => {
    syncWithRoute(pathname);
  }, [pathname, syncWithRoute]);

  // 监听 Electron 主进程发出的窗口关闭事件
  useEffect(() => {
    if (!window.electronAPI?.onWindowClosing) return;
    const cleanup = window.electronAPI.onWindowClosing(() => {
      setShowCloseDialog(true);
    });
    return cleanup;
  }, []);

  // 监听退出前同步事件：主进程通知渲染进程执行一次同步
  useEffect(() => {
    if (!window.electronAPI?.onSyncBeforeQuit) return;
    const cleanup = window.electronAPI.onSyncBeforeQuit(async () => {
      try {
        await sync();
      } catch (err) {
        console.error('[AppLayout] Sync before quit failed:', err);
      } finally {
        // 无论同步成功与否，都通知主进程可以继续退出
        window.electronAPI?.notifySyncComplete();
      }
    });
    return cleanup;
  }, [sync]);

  // 键盘快捷键：Esc退出模块，数字键导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果焦点在输入元素中，不拦截
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape' && isInModule) {
        exitModule();
        navigate('/');
      }

      // 数字键 1-6 快捷导航（需无修饰键）
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const moduleKeys: Record<string, string> = {
          '1': '/', '2': '/pomodoro', '3': '/notes',
          '4': '/flashcards', '5': '/feynman', '6': '/inspiration',
        };
        if (moduleKeys[e.key]) {
          navigate(moduleKeys[e.key]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInModule, exitModule, navigate]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Layer 2: 始终最顶层 — Electron标题栏 */}
      <CustomTitlebar />

      {/* Layer 0: 3D场景全屏背景 */}
      <SceneProvider>
        <SceneTransition />
        <SpatialNav />
      </SceneProvider>

      {/* Layer 1: 功能覆盖层 */}
      <AnimatePresence mode="popLayout">
        {isInModule && (
          <FunctionalOverlay key={currentModule}>
            <Outlet />
          </FunctionalOverlay>
        )}
      </AnimatePresence>

      {/* 非模块内时显示简洁的状态提示 */}
      {!isInModule && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 py-3 rounded-full bg-black/30 backdrop-blur-xl border border-white/10 text-white/70 text-sm"
          >
            点击3D物体进入模块 · 按 Ctrl+K 命令面板 · 数字键 1-6 快捷跳转
          </motion.div>
        </div>
      )}

      {/* 移动端底部标签栏 — 置于功能覆盖层之上，避免被 3D 场景或模块遮罩覆盖 */}
      <BottomNav />

      {/* 全局组件 */}
      <CommandPalette />
      <CloseConfirmDialog open={showCloseDialog} onClose={() => setShowCloseDialog(false)} />
    </div>
  );
}
