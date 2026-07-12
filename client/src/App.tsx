import { useState, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast';
import AchievementToast from '@/components/ui/AchievementToast';
import UpdateNotification from '@/components/ui/UpdateNotification';
import ConsentModal, { CURRENT_CONSENT_VERSION } from '@/components/ui/ConsentModal';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { SyncProvider } from '@/lib/sync/SyncContext';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { router } from '@/routes';
import { useTheme } from '@/hooks/useTheme';
import { db } from '@/lib/storage/database';
import { soundPlayer } from '@/lib/audio/SoundPlayer';
import '@/stores/useSettingsStore'; // 导入以触发音效设置初始化

// 启动时预加载所有音效（不阻塞渲染）
soundPlayer.preloadAll();

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

  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);

  useEffect(() => {
    // 检查是否已同意隐私政策
    db.consent
      .where('type')
      .equals('privacy')
      .first()
      .then((record) => {
        setConsentGiven(!!record);
      })
      .catch(() => {
        setConsentGiven(false);
      });
  }, []);

  const handleAcceptConsent = async () => {
    const now = new Date();
    await db.consent.bulkPut([
      { id: crypto.randomUUID(), type: 'privacy' as const, version: CURRENT_CONSENT_VERSION, acceptedAt: now },
      { id: crypto.randomUUID(), type: 'terms' as const, version: CURRENT_CONSENT_VERSION, acceptedAt: now },
    ]);
    setConsentGiven(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <SyncProvider>
            {consentGiven === false && (
              <ConsentModal onAccept={handleAcceptConsent} />
            )}
            <ErrorBoundary>
              <RouterProvider router={router} />
              <AchievementToast />
              <UpdateNotification />
            </ErrorBoundary>
          </SyncProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
