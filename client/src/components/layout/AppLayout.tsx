import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import Navbar from './Navbar';

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

  // 应用信息密度
  useEffect(() => {
    applyDensity();
  }, []);

  // Hide navigation for immersive study sessions
  const isStudySession = Boolean(pathname.match(/^\/flashcards\/[^/]+\/study$/));

  if (isStudySession) {
    return (
      <main className="min-h-screen bg-bg-primary">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg-primary">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top navbar */}
        <Navbar />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
