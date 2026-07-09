import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';

// Lazy-loaded pages
const Dashboard = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const PomodoroPage = lazy(() => import('@/features/pomodoro/pages/PomodoroPage'));
const PomodoroStatsPage = lazy(() => import('@/features/pomodoro/pages/PomodoroStatsPage'));
const PomodoroSettingsPage = lazy(() => import('@/features/pomodoro/pages/PomodoroSettingsPage'));
const NotesPage = lazy(() => import('@/features/notes/pages/NotesPage'));
const NoteEditPage = lazy(() => import('@/features/notes/pages/NoteEditPage'));
const FlashcardsPage = lazy(() => import('@/features/flashcards/pages/FlashcardsPage'));
const DeckDetailPage = lazy(() => import('@/features/flashcards/pages/DeckDetailPage'));
const StudySessionPage = lazy(() => import('@/features/flashcards/pages/StudySessionPage'));
const FeynmanPage = lazy(() => import('@/features/feynman/pages/FeynmanPage'));
const FeynmanSessionPage = lazy(() => import('@/features/feynman/pages/FeynmanSessionPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));

// Loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-kb-md">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-kb-full animate-spin" />
        <span className="text-b2 text-text-tertiary">加载中...</span>
      </div>
    </div>
  );
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <SuspenseWrapper><Dashboard /></SuspenseWrapper> },
      { path: '/pomodoro', element: <SuspenseWrapper><PomodoroPage /></SuspenseWrapper> },
      { path: '/pomodoro/stats', element: <SuspenseWrapper><PomodoroStatsPage /></SuspenseWrapper> },
      { path: '/pomodoro/settings', element: <SuspenseWrapper><PomodoroSettingsPage /></SuspenseWrapper> },
      { path: '/notes', element: <SuspenseWrapper><NotesPage /></SuspenseWrapper> },
      { path: '/notes/:id', element: <SuspenseWrapper><NoteEditPage /></SuspenseWrapper> },
      { path: '/flashcards', element: <SuspenseWrapper><FlashcardsPage /></SuspenseWrapper> },
      { path: '/flashcards/:deckId', element: <SuspenseWrapper><DeckDetailPage /></SuspenseWrapper> },
      { path: '/flashcards/:deckId/study', element: <SuspenseWrapper><StudySessionPage /></SuspenseWrapper> },
      { path: '/feynman', element: <SuspenseWrapper><FeynmanPage /></SuspenseWrapper> },
      { path: '/feynman/:sessionId', element: <SuspenseWrapper><FeynmanSessionPage /></SuspenseWrapper> },
      { path: '/settings', element: <SuspenseWrapper><SettingsPage /></SuspenseWrapper> },
    ],
  },
  {
    path: '/onboarding',
    element: <SuspenseWrapper><OnboardingPage /></SuspenseWrapper>,
  },
  {
    path: '/login',
    element: <SuspenseWrapper><LoginPage /></SuspenseWrapper>,
  },
  {
    path: '/register',
    element: <SuspenseWrapper><RegisterPage /></SuspenseWrapper>,
  },
];

export const router = createBrowserRouter(routes);
