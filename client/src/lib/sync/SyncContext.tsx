import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { syncEngine, type SyncResult, type SyncEvent } from './SyncEngine';
import { useAuth } from '../auth/AuthContext';
import { networkManager } from './NetworkManager';
import { modeManager } from '../mode/ModeManager';

interface SyncState {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  lastResult: SyncResult | null;
  pendingCount: number;
  conflictCount: number;
}

interface SyncContextValue extends SyncState {
  sync: () => Promise<SyncResult>;
  isOnline: boolean;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<SyncState>({
    isSyncing: false,
    lastSyncAt: null,
    lastResult: null,
    pendingCount: 0,
    conflictCount: 0,
  });
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubNetwork = networkManager.subscribe((netState) => {
      setIsOnline(netState.status !== 'offline');
    });
    return unsubNetwork;
  }, []);

  // 订阅同步引擎事件
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = syncEngine.subscribe((event: SyncEvent) => {
      switch (event.type) {
        case 'sync-start':
          setState(prev => ({ ...prev, isSyncing: true }));
          break;
        case 'sync-complete':
          setState(prev => ({
            ...prev,
            isSyncing: false,
            lastSyncAt: new Date(),
            lastResult: event.result,
            conflictCount: prev.conflictCount + event.result.conflicts.length,
          }));
          break;
        case 'sync-error':
          setState(prev => ({ ...prev, isSyncing: false }));
          break;
      }
    });

    return unsubscribe;
  }, [isAuthenticated]);

  // 模式感知：注册网络恢复时的同步监听（不再使用定时同步）
  useEffect(() => {
    if (!isAuthenticated) return;

    const modeConfig = modeManager.getConfig();
    if (modeConfig.syncEnabled) {
      syncEngine.registerNetworkRecoverySync();
    }

    const unsubscribe = modeManager.subscribe((_mode, config) => {
      if (config.syncEnabled) {
        syncEngine.registerNetworkRecoverySync();
      } else {
        syncEngine.unregisterNetworkRecoverySync();
      }
    });

    return () => {
      unsubscribe();
      syncEngine.unregisterNetworkRecoverySync();
    };
  }, [isAuthenticated]);

  const sync = useCallback(async () => {
    return syncEngine.sync();
  }, []);

  return (
    <SyncContext.Provider value={{ ...state, sync, isOnline }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
