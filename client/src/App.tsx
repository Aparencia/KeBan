import { useState, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast';
import AchievementToast from '@/components/ui/AchievementToast';
import UpdateNotification from '@/components/ui/UpdateNotification';
import ConsentModal, { CURRENT_CONSENT_VERSION } from '@/components/ui/ConsentModal';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { SyncProvider } from '@/lib/sync/SyncContext';
import { router } from '@/routes';
import { useTheme } from '@/hooks/useTheme';
import { db } from '@/lib/storage/database';
import { soundPlayer } from '@/lib/audio/SoundPlayer';
import { initSoundPreferences } from '@/pages/settings/SoundSettings';

// 启动时读取音效偏好并预加载所有音效（不阻塞渲染）
initSoundPreferences();
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
      <AuthProvider>
        <SyncProvider>
          <ToastProvider>
            {consentGiven === false && (
              <ConsentModal onAccept={handleAcceptConsent} />
            )}
            <RouterProvider router={router} />
            <AchievementToast />
            <UpdateNotification />
          </ToastProvider>
        </SyncProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
