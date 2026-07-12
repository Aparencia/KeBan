import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import Navbar from './Navbar';
import CommandPalette from '../ui/CommandPalette';
import { CloseConfirmDialog } from '../ui/CloseConfirmDialog';
import { CustomTitlebar } from './CustomTitlebar';
import SyncStatusBar from '../sync/SyncStatusBar';
import { PageTransition } from './PageTransition';
import { useSessionExpiry } from '@/hooks/useSessionExpiry';

const DENSITY_KEY = 'keban-density';

function applyDensity() {
  try {
    const v = localStorage.getItem(DENSITY_KEY);
    if (v === 'compact' || v === 'normal' || v === 'loose') {
      document.documentElement.setAttribute('data-density', v);
      return;
    }
  } catch { /* ignore */ }
  document.documentElement.removeAttribute('data-density');
}

export default function AppLayout() {
  const { pathname } = useLocation();
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  // 监听 session 过期事件
  useSessionExpiry();

  // 应用信息密度
  useEffect(() => {
    applyDensity();
  }, []);

  // 监听 Electron 主进程发出的窗口关闭事件
  useEffect(() => {
    if (!window.electronAPI?.onWindowClosing) return;
    const cleanup = window.electronAPI.onWindowClosing(() => {
      setShowCloseDialog(true);
    });
    return cleanup;
  }, []);

  // Hide navigation for immersive study sessions
  const isStudySession = Boolean(pathname.match(/^\/flashcards\/[^/]+\/study$/));

  if (isStudySession) {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <CustomTitlebar />
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      {/* 自定义标题栏（frameless 窗口） */}
      <CustomTitlebar />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Top navbar */}
          <Navbar />

          {/* 同步/网络状态横幅 */}
          <SyncStatusBar />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0 relative">
            <AnimatePresence mode="wait" initial={false}>
              <PageTransition key={pathname}>
                <Outlet />
              </PageTransition>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* 全局命令面板 */}
      <CommandPalette />

      {/* 关闭窗口行为确认对话框 */}
      <CloseConfirmDialog
        open={showCloseDialog}
        onClose={() => setShowCloseDialog(false)}
      />

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
