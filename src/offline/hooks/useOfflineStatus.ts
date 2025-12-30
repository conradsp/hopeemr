import { useState, useEffect, useCallback } from 'react';
import { SyncQueue } from '../sync/SyncQueue';

/**
 * Hook for detecting online/offline status
 */
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingChanges, setPendingChanges] = useState(0);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await SyncQueue.getPendingCount();
      setPendingChanges(count);
    } catch (error) {
      console.error('Error getting pending count:', error);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      SyncQueue.emitConnectionChange(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      SyncQueue.emitConnectionChange(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to sync events to update pending count
    const unsubscribeStart = SyncQueue.on('sync:start', updatePendingCount);
    const unsubscribeComplete = SyncQueue.on('sync:complete', updatePendingCount);
    const unsubscribeItemSuccess = SyncQueue.on('sync:item:success', updatePendingCount);

    // Initial pending count
    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeStart();
      unsubscribeComplete();
      unsubscribeItemSuccess();
    };
  }, [updatePendingCount]);

  return {
    isOnline,
    pendingChanges,
    refreshPendingCount: updatePendingCount,
  };
}
