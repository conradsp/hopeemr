import { MedplumClient } from '@medplum/core';
import { Resource } from '@medplum/fhirtypes';
import { SyncQueue } from './SyncQueue';
import { saveLocalIdMapping, updateMetadata, cachePatient, cacheEncounter, cacheObservation, cacheMedicationRequest, cacheServiceRequest, cacheDocumentReference } from '../db/operations';
import { SyncQueueItem, SyncManagerConfig, DEFAULT_SYNC_CONFIG, CacheableResourceType, SyncableResourceType, SyncOnlyResourceType } from '../types';

/** Resource types that don't need local caching after sync */
const SYNC_ONLY_TYPES: SyncOnlyResourceType[] = ['DetectedIssue'];

/** Check if a resource type is sync-only (no local caching) */
function isSyncOnlyType(resourceType: SyncableResourceType): resourceType is SyncOnlyResourceType {
  return SYNC_ONLY_TYPES.includes(resourceType as SyncOnlyResourceType);
}

/**
 * SyncManager orchestrates background synchronization of offline changes
 */
class SyncManagerClass {
  private config: SyncManagerConfig = DEFAULT_SYNC_CONFIG;
  private isSyncing = false;
  private medplumClient: MedplumClient | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize the sync manager with Medplum client
   */
  initialize(medplum: MedplumClient, config?: Partial<SyncManagerConfig>): void {
    this.medplumClient = medplum;
    if (config) {
      this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    }

    // Set up online/offline listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  /**
   * Clean up event listeners
   */
  cleanup(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    this.stopAutoSync();
  }

  /**
   * Handle coming back online
   */
  private handleOnline = async (): Promise<void> => {
    SyncQueue.emitConnectionChange(true);
    if (this.config.autoSyncOnReconnect) {
      await this.sync();
    }
  };

  /**
   * Handle going offline
   */
  private handleOffline = (): void => {
    SyncQueue.emitConnectionChange(false);
  };

  /**
   * Start auto-sync at regular intervals
   */
  startAutoSync(intervalMs = 60000): void {
    this.stopAutoSync();
    this.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.sync().catch(console.error);
      }
    }, intervalMs);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Check if sync is currently in progress
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Perform sync of all pending items
   */
  async sync(): Promise<{ success: number; failed: number }> {
    if (this.isSyncing) {
      return { success: 0, failed: 0 };
    }

    if (!this.medplumClient) {
      throw new Error('SyncManager not initialized. Call initialize() first.');
    }

    if (!navigator.onLine) {
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    let success = 0;
    let failed = 0;

    try {
      const items = await SyncQueue.getPendingItems(this.config.batchSize);

      for (const item of items) {
        try {
          await SyncQueue.markSyncing(item.id);
          await this.syncItem(item);
          await SyncQueue.markCompleted(item.id, item.serverId);
          success++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Check if we should retry
          if (item.retryCount < item.maxRetries) {
            await SyncQueue.markFailed(item.id, errorMessage);
          } else {
            // Max retries exceeded - mark as permanently failed
            await SyncQueue.markFailed(item.id, `Max retries exceeded: ${errorMessage}`);
          }
          failed++;
        }
      }

      // Clear completed items
      await SyncQueue.clearCompleted();

      // Update metadata
      const pendingCount = await SyncQueue.getPendingCount();
      await updateMetadata({
        lastSync: Date.now(),
        pendingCount,
      });

      SyncQueue.emitSyncComplete(pendingCount);

      return { success, failed };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      SyncQueue.emitSyncError(errorMessage);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single queue item
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    if (!this.medplumClient) {
      throw new Error('SyncManager not initialized');
    }

    switch (item.operation) {
      case 'create':
        await this.syncCreate(item);
        break;
      case 'update':
        await this.syncUpdate(item);
        break;
      case 'delete':
        await this.syncDelete(item);
        break;
    }
  }

  /**
   * Sync a create operation
   */
  private async syncCreate(item: SyncQueueItem): Promise<void> {
    if (!this.medplumClient) {
      throw new Error('SyncManager not initialized');
    }

    // Remove the temporary ID before sending to server
    const resourceToCreate = { ...item.resource };
    if (resourceToCreate.id?.startsWith('offline-')) {
      delete resourceToCreate.id;
    }

    // Create on server
    const created = await this.medplumClient.createResource(resourceToCreate as Resource);

    // Save ID mapping if we had a local ID (only for cacheable resources)
    if (item.localId && created.id && !isSyncOnlyType(item.resourceType)) {
      await saveLocalIdMapping(item.localId, created.id, item.resourceType as CacheableResourceType);
      item.serverId = created.id;
    }

    // Update local cache with server version (skip for sync-only types like DetectedIssue)
    if (!isSyncOnlyType(item.resourceType)) {
      await this.updateLocalCache(item.resourceType as CacheableResourceType, created);
    }
  }

  /**
   * Sync an update operation
   */
  private async syncUpdate(item: SyncQueueItem): Promise<void> {
    if (!this.medplumClient) {
      throw new Error('SyncManager not initialized');
    }

    // Update on server
    const updated = await this.medplumClient.updateResource(item.resource);

    // Update local cache (skip for sync-only types like DetectedIssue)
    if (!isSyncOnlyType(item.resourceType)) {
      await this.updateLocalCache(item.resourceType as CacheableResourceType, updated);
    }
  }

  /**
   * Sync a delete operation
   */
  private async syncDelete(item: SyncQueueItem): Promise<void> {
    if (!this.medplumClient || !item.resource.id) {
      throw new Error('SyncManager not initialized or resource has no ID');
    }

    // Delete on server
    await this.medplumClient.deleteResource(item.resourceType, item.resource.id);
  }

  /**
   * Update local cache with synced resource
   */
  private async updateLocalCache(resourceType: CacheableResourceType, resource: Resource): Promise<void> {
    switch (resourceType) {
      case 'Patient':
        await cachePatient(resource as Parameters<typeof cachePatient>[0]);
        break;
      case 'Encounter':
        await cacheEncounter(resource as Parameters<typeof cacheEncounter>[0]);
        break;
      case 'Observation':
        await cacheObservation(resource as Parameters<typeof cacheObservation>[0]);
        break;
      case 'MedicationRequest':
        await cacheMedicationRequest(resource as Parameters<typeof cacheMedicationRequest>[0]);
        break;
      case 'ServiceRequest':
        await cacheServiceRequest(resource as Parameters<typeof cacheServiceRequest>[0]);
        break;
      case 'DocumentReference':
        await cacheDocumentReference(resource as Parameters<typeof cacheDocumentReference>[0]);
        break;
    }
  }

  /**
   * Calculate delay for retry with exponential backoff
   */
  getRetryDelay(retryCount: number): number {
    const delay = this.config.baseRetryDelay * Math.pow(2, retryCount);
    return Math.min(delay, this.config.maxRetryDelay);
  }
}

// Export singleton instance
export const SyncManager = new SyncManagerClass();
