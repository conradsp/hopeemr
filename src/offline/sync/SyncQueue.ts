import { Resource } from '@medplum/fhirtypes';
import {
  addToSyncQueue,
  getPendingSyncItems,
  getPendingSyncCount,
  updateSyncItemStatus,
  clearCompletedSyncItems,
  getSyncItem,
} from '../db/operations';
import { SyncQueueItem, SyncableResourceType, SyncStatus, SyncEvent, SyncEventType } from '../types';

type SyncEventListener = (event: SyncEvent) => void;

/**
 * SyncQueue manages pending offline operations
 * Provides methods for adding, retrieving, and managing sync items
 */
class SyncQueueClass {
  private listeners: Map<SyncEventType, Set<SyncEventListener>> = new Map();

  /**
   * Add a create operation to the sync queue
   */
  async queueCreate(
    resourceType: SyncableResourceType,
    resource: Resource,
    localId?: string
  ): Promise<SyncQueueItem> {
    const item = await addToSyncQueue('create', resourceType, resource, localId);
    this.emit('sync:start', { pendingCount: await this.getPendingCount() });
    return item;
  }

  /**
   * Add an update operation to the sync queue
   */
  async queueUpdate(resourceType: SyncableResourceType, resource: Resource): Promise<SyncQueueItem> {
    const item = await addToSyncQueue('update', resourceType, resource);
    this.emit('sync:start', { pendingCount: await this.getPendingCount() });
    return item;
  }

  /**
   * Add a delete operation to the sync queue
   */
  async queueDelete(resourceType: SyncableResourceType, resource: Resource): Promise<SyncQueueItem> {
    const item = await addToSyncQueue('delete', resourceType, resource);
    this.emit('sync:start', { pendingCount: await this.getPendingCount() });
    return item;
  }

  /**
   * Get pending items ready for sync
   */
  async getPendingItems(limit?: number): Promise<SyncQueueItem[]> {
    return getPendingSyncItems(limit);
  }

  /**
   * Get count of pending items
   */
  async getPendingCount(): Promise<number> {
    return getPendingSyncCount();
  }

  /**
   * Get a specific sync item by ID
   */
  async getItem(id: string): Promise<SyncQueueItem | null> {
    return getSyncItem(id);
  }

  /**
   * Mark an item as syncing
   */
  async markSyncing(id: string): Promise<void> {
    await updateSyncItemStatus(id, 'syncing');
  }

  /**
   * Mark an item as successfully synced
   */
  async markCompleted(id: string, serverId?: string): Promise<void> {
    await updateSyncItemStatus(id, 'completed', undefined, serverId);
    this.emit('sync:item:success', { itemId: id });
  }

  /**
   * Mark an item as failed
   */
  async markFailed(id: string, error: string): Promise<void> {
    await updateSyncItemStatus(id, 'failed', error);
    this.emit('sync:item:error', { itemId: id, error });
  }

  /**
   * Clear all completed items from the queue
   */
  async clearCompleted(): Promise<void> {
    await clearCompletedSyncItems();
  }

  /**
   * Check if there are any pending items
   */
  async hasPending(): Promise<boolean> {
    const count = await this.getPendingCount();
    return count > 0;
  }

  /**
   * Subscribe to sync events
   */
  on(eventType: SyncEventType, listener: SyncEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Emit a sync event
   */
  private emit(type: SyncEventType, data?: SyncEvent['data']): void {
    const event: SyncEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    this.listeners.get(type)?.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in sync event listener:', error);
      }
    });
  }

  /**
   * Emit connection status change
   */
  emitConnectionChange(isOnline: boolean): void {
    this.emit(isOnline ? 'connection:online' : 'connection:offline');
  }

  /**
   * Emit sync complete
   */
  emitSyncComplete(pendingCount: number): void {
    this.emit('sync:complete', { pendingCount });
  }

  /**
   * Emit sync error
   */
  emitSyncError(error: string): void {
    this.emit('sync:error', { error });
  }
}

// Export singleton instance
export const SyncQueue = new SyncQueueClass();
