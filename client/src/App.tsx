import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast';
import AchievementToast from '@/components/ui/AchievementToast';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { SyncProvider } from '@/lib/sync/SyncContext';
import { router } from '@/routes';
import { useTheme } from '@/hooks/useTheme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function App() {
  // Initialize theme on app mount
  useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SyncProvider>
          <ToastProvider>
            <RouterProvider router={router} />
            <AchievementToast />
          </ToastProvider>
        </SyncProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
