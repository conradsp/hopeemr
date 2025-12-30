import { createContext, useContext, useEffect, useState, useCallback, ReactNode, JSX } from 'react';
import { useMedplum } from '@medplum/react';
import { SyncManager } from './sync/SyncManager';
import { SyncQueue } from './sync/SyncQueue';
import { isResourceCached, getMetadata } from './db/operations';
import { OfflineContextValue, CacheableResourceType } from './types';

const OfflineContext = createContext<OfflineContextValue | null>(null);

interface OfflineProviderProps {
  children: ReactNode;
}

/**
 * Provider component that manages offline state and sync functionality
 */
export function OfflineProvider({ children }: OfflineProviderProps): JSX.Element {
  const medplum = useMedplum();
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize SyncManager with Medplum client
  useEffect(() => {
    SyncManager.initialize(medplum);

    // Load initial metadata
    getMetadata().then((metadata) => {
      if (metadata?.lastSync) {
        setLastSyncTime(new Date(metadata.lastSync));
      }
      if (metadata?.pendingCount !== undefined) {
        setPendingChanges(metadata.pendingCount);
      }
    });

    return () => {
      SyncManager.cleanup();
    };
  }, [medplum]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Subscribe to sync events
  useEffect(() => {
    const updatePendingCount = async () => {
      const count = await SyncQueue.getPendingCount();
      setPendingChanges(count);
    };

    const unsubscribeStart = SyncQueue.on('sync:start', () => {
      updatePendingCount();
    });

    const unsubscribeComplete = SyncQueue.on('sync:complete', (event) => {
      setIsSyncing(false);
      setLastSyncTime(new Date());
      if (event.data?.pendingCount !== undefined) {
        setPendingChanges(event.data.pendingCount);
      }
    });

    const unsubscribeError = SyncQueue.on('sync:error', () => {
      setIsSyncing(false);
    });

    const unsubscribeItemSuccess = SyncQueue.on('sync:item:success', () => {
      updatePendingCount();
    });

    // Initial count
    updatePendingCount();

    return () => {
      unsubscribeStart();
      unsubscribeComplete();
      unsubscribeError();
      unsubscribeItemSuccess();
    };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingChanges > 0 && !isSyncing) {
      syncNow();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Manually trigger sync
   */
  const syncNow = useCallback(async (): Promise<void> => {
    if (isSyncing || !isOnline) {
      return;
    }

    setIsSyncing(true);
    try {
      await SyncManager.sync();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline]);

  /**
   * Check if a resource is available in offline cache
   */
  const checkResourceCached = useCallback(
    async (resourceType: CacheableResourceType, id: string): Promise<boolean> => {
      return isResourceCached(resourceType, id);
    },
    []
  );

  const contextValue: OfflineContextValue = {
    isOnline,
    pendingChanges,
    lastSyncTime,
    isSyncing,
    syncNow,
    isResourceCached: checkResourceCached,
  };

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
    </OfflineContext.Provider>
  );
}

/**
 * Hook to access offline context
 */
export function useOffline(): OfflineContextValue {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
