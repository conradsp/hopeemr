import { createContext, useContext, useEffect, useState, useCallback, ReactNode, JSX } from 'react';
import { useMedplum } from '@medplum/react';
import { SyncManager } from './sync/SyncManager';
import { SyncQueue } from './sync/SyncQueue';
import { isResourceCached, getMetadata } from './db/operations';
import { OfflineContextValue, CacheableResourceType } from './types';
import {
  initializeEncryption,
  clearEncryptionKey,
  isEncryptionReady,
  isEncryptionSupported,
} from './crypto';
import { logger } from '../utils/logger';

/**
 * Feature flag for offline encryption
 * Set VITE_ENABLE_OFFLINE_ENCRYPTION=true in .env to enable
 */
const ENCRYPTION_ENABLED = import.meta.env.VITE_ENABLE_OFFLINE_ENCRYPTION === 'true';

/**
 * Extended offline context with encryption status
 */
interface ExtendedOfflineContextValue extends OfflineContextValue {
  /** Whether encryption is enabled and ready */
  isEncryptionReady: boolean;
}

const OfflineContext = createContext<ExtendedOfflineContextValue | null>(null);

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
  const [encryptionReady, setEncryptionReady] = useState(false);

  // Initialize SyncManager and encryption with Medplum client
  useEffect(() => {
    const initSync = async () => {
      // Initialize SyncManager (also recovers orphaned sync items from crashes)
      await SyncManager.initialize(medplum);

      // Initialize encryption if enabled and supported
      if (ENCRYPTION_ENABLED && isEncryptionSupported()) {
        try {
          const accessToken = medplum.getAccessToken();
          if (accessToken) {
            await initializeEncryption(accessToken);
            setEncryptionReady(true);
            logger.info('Offline encryption initialized');
          } else {
            logger.warn('No access token available for encryption initialization');
          }
        } catch (error) {
          logger.error('Failed to initialize offline encryption', {
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue without encryption - data will be stored unencrypted
        }
      }

      // Load initial metadata
      const metadata = await getMetadata();
      if (metadata?.lastSync) {
        setLastSyncTime(new Date(metadata.lastSync));
      }
      if (metadata?.pendingCount !== undefined) {
        setPendingChanges(metadata.pendingCount);
      }
    };

    initSync();

    return () => {
      SyncManager.cleanup();
      // Clear encryption key on unmount (logout)
      if (ENCRYPTION_ENABLED) {
        clearEncryptionKey();
        setEncryptionReady(false);
      }
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

  const contextValue: ExtendedOfflineContextValue = {
    isOnline,
    pendingChanges,
    lastSyncTime,
    isSyncing,
    syncNow,
    isResourceCached: checkResourceCached,
    isEncryptionReady: encryptionReady,
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
export function useOffline(): ExtendedOfflineContextValue {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
