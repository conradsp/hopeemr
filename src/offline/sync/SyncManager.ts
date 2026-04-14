import { MedplumClient } from '@medplum/core';
import { Resource } from '@medplum/fhirtypes';
import { SyncQueue } from './SyncQueue';
import { saveLocalIdMapping, updateMetadata, cachePatient, cacheEncounter, cacheObservation, cacheMedicationRequest, cacheServiceRequest, cacheDocumentReference, deleteCachedPatient, getCachedVersionId } from '../db/operations';
import { SyncQueueItem, SyncManagerConfig, DEFAULT_SYNC_CONFIG, CacheableResourceType, SyncableResourceType, SyncOnlyResourceType } from '../types';
import { logger } from '../../utils/logger';

/** Resource types that don't need local caching after sync */
const SYNC_ONLY_TYPES: SyncOnlyResourceType[] = ['DetectedIssue'];

/** Check if a resource type is sync-only (no local caching) */
function isSyncOnlyType(resourceType: SyncableResourceType): resourceType is SyncOnlyResourceType {
  return SYNC_ONLY_TYPES.includes(resourceType as SyncOnlyResourceType);
}

/**
 * Simple async mutex for preventing concurrent sync operations
 */
class AsyncMutex {
  private locked = false;
  private waitQueue: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      next?.();
    } else {
      this.locked = false;
    }
  }

  isLocked(): boolean {
    return this.locked;
  }
}

/**
 * SyncManager orchestrates background synchronization of offline changes
 */
class SyncManagerClass {
  private config: SyncManagerConfig = DEFAULT_SYNC_CONFIG;
  private syncMutex = new AsyncMutex();
  private medplumClient: MedplumClient | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize the sync manager with Medplum client
   */
  async initialize(medplum: MedplumClient, config?: Partial<SyncManagerConfig>): Promise<void> {
    this.medplumClient = medplum;
    if (config) {
      this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    }

    // Recover any items orphaned from previous crash/restart
    // Items stuck in 'syncing' status for > 5 minutes are reset to 'pending'
    try {
      const recoveredCount = await SyncQueue.recoverOrphaned();
      if (recoveredCount > 0) {
        logger.info('Recovered orphaned sync items', { count: recoveredCount });
      }
    } catch (error) {
      logger.error('Failed to recover orphaned sync items', {
        error: error instanceof Error ? error.message : String(error),
      });
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
        this.sync().catch((error) => {
          logger.error('Auto-sync failed', { error: error instanceof Error ? error.message : String(error) });
        });
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
    return this.syncMutex.isLocked();
  }

  /**
   * Perform sync of all pending items
   * Uses mutex to prevent concurrent sync operations
   */
  async sync(): Promise<{ success: number; failed: number }> {
    // Try to acquire lock - if already syncing, return early
    if (this.syncMutex.isLocked()) {
      logger.debug('Sync already in progress, skipping');
      return { success: 0, failed: 0 };
    }

    await this.syncMutex.acquire();

    if (!this.medplumClient) {
      this.syncMutex.release();
      throw new Error('SyncManager not initialized. Call initialize() first.');
    }

    if (!navigator.onLine) {
      this.syncMutex.release();
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    try {
      const items = await SyncQueue.getPendingItems(this.config.batchSize);
      logger.info('Starting sync', { pendingItems: items.length });

      for (const item of items) {
        try {
          await SyncQueue.markSyncing(item.id);
          const serverId = await this.syncItem(item);

          // Mark completed with the server ID (now properly set)
          await SyncQueue.markCompleted(item.id, serverId);
          success++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Sync item failed', {
            itemId: item.id,
            operation: item.operation,
            resourceType: item.resourceType,
            error: errorMessage,
            retryCount: item.retryCount
          });

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

      // Update metadata - only update lastSync timestamp if ALL items succeeded
      const pendingCount = await SyncQueue.getPendingCount();
      await updateMetadata({
        lastSync: failed === 0 ? Date.now() : undefined, // Only update if fully successful
        pendingCount,
      });

      SyncQueue.emitSyncComplete(pendingCount);
      logger.info('Sync completed', { success, failed, pendingCount });

      return { success, failed };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Sync batch failed', { error: errorMessage });
      SyncQueue.emitSyncError(errorMessage);
      throw error;
    } finally {
      this.syncMutex.release();
    }
  }

  /**
   * Sync a single queue item
   * Returns the server ID for create operations
   */
  private async syncItem(item: SyncQueueItem): Promise<string | undefined> {
    if (!this.medplumClient) {
      throw new Error('SyncManager not initialized');
    }

    switch (item.operation) {
      case 'create':
        return await this.syncCreate(item);
      case 'update':
        await this.syncUpdate(item);
        return item.resource.id;
      case 'delete':
        await this.syncDelete(item);
        return undefined;
    }
  }

  /**
   * Sync a create operation with idempotency check
   * Returns the server ID of the created/existing resource
   */
  private async syncCreate(item: SyncQueueItem): Promise<string | undefined> {
    if (!this.medplumClient) {
      throw new Error('SyncManager not initialized');
    }

    // Remove the temporary ID before sending to server
    const resourceToCreate = { ...item.resource };
    const tempId = resourceToCreate.id;
    if (tempId?.startsWith('offline-')) {
      delete resourceToCreate.id;
    }

    // IDEMPOTENCY CHECK: Before creating, check if resource already exists
    // This prevents duplicates if a previous create succeeded but response failed
    const existingResource = await this.findExistingResource(item, resourceToCreate);

    let created: Resource;
    if (existingResource) {
      // Resource already exists on server (previous sync succeeded but we didn't get the response)
      logger.info('Resource already exists on server, using existing', {
        resourceType: item.resourceType,
        serverId: existingResource.id
      });
      created = existingResource;
    } else {
      // Create on server
      created = await this.medplumClient.createResource(resourceToCreate as Resource);
    }

    // Save ID mapping and update serverId BEFORE returning
    // This ensures the mapping is saved even if later operations fail
    let serverId: string | undefined;
    if (item.localId && created.id && !isSyncOnlyType(item.resourceType)) {
      await saveLocalIdMapping(item.localId, created.id, item.resourceType as CacheableResourceType);
      serverId = created.id;
    }

    // Update local cache with server version (skip for sync-only types like DetectedIssue)
    if (!isSyncOnlyType(item.resourceType)) {
      await this.updateLocalCache(item.resourceType as CacheableResourceType, created);
    }

    return serverId;
  }

  /**
   * Find an existing resource on the server that matches the one we're trying to create
   * This is used for idempotency - to detect if a previous create succeeded
   */
  private async findExistingResource(item: SyncQueueItem, resource: Resource): Promise<Resource | null> {
    if (!this.medplumClient) {
      return null;
    }

    try {
      // Use identifiers to find existing resources
      const identifiers = (resource as { identifier?: Array<{ system?: string; value?: string }> }).identifier;

      if (identifiers && identifiers.length > 0) {
        // Search by the first identifier
        const identifier = identifiers[0];
        if (identifier.system && identifier.value) {
          const result = await this.medplumClient.search(item.resourceType, {
            identifier: `${identifier.system}|${identifier.value}`,
            _count: '1'
          });

          if (result.entry && result.entry.length > 0) {
            return result.entry[0].resource as Resource;
          }
        }
      }

      // For patients, also try searching by name + birthDate
      if (item.resourceType === 'Patient') {
        const patient = resource as { name?: Array<{ family?: string; given?: string[] }>; birthDate?: string };
        if (patient.name?.[0]?.family && patient.birthDate) {
          const result = await this.medplumClient.search('Patient', {
            family: patient.name[0].family,
            birthdate: patient.birthDate,
            _count: '1'
          });

          if (result.entry && result.entry.length > 0) {
            return result.entry[0].resource as Resource;
          }
        }
      }

      return null;
    } catch (error) {
      // If search fails, assume resource doesn't exist and proceed with create
      logger.debug('Idempotency check failed, proceeding with create', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Sync an update operation with conflict detection (server-wins strategy)
   */
  private async syncUpdate(item: SyncQueueItem): Promise<void> {
    if (!this.medplumClient) {
      throw new Error('SyncManager not initialized');
    }

    const resourceId = item.resource.id;

    // Check for conflicts if this is a cacheable resource with an ID
    if (resourceId && !isSyncOnlyType(item.resourceType)) {
      try {
        // Get the cached version ID we had when the offline change was made
        const cachedVersionId = await getCachedVersionId(
          item.resourceType as CacheableResourceType,
          resourceId
        );

        // Fetch current server version
        const serverResource = await this.medplumClient.readResource(
          item.resourceType,
          resourceId
        );
        const serverVersionId = serverResource.meta?.versionId;

        // Detect conflict: server version changed since we cached
        if (cachedVersionId && serverVersionId && cachedVersionId !== serverVersionId) {
          // Log the conflict (server-wins strategy)
          logger.warn('Sync conflict detected - server version wins', {
            resourceType: item.resourceType,
            resourceId,
            cachedVersion: cachedVersionId,
            serverVersion: serverVersionId,
            localChanges: JSON.stringify(item.resource).substring(0, 500), // Truncated for logging
            resolution: 'server-wins',
          });

          // Server-wins: update local cache with server version, discard local changes
          await this.updateLocalCache(item.resourceType as CacheableResourceType, serverResource);
          return; // Skip the update, accept server version
        }
      } catch (error) {
        // If we can't read the server resource (404 or other error), proceed with update
        logger.debug('Conflict check failed, proceeding with update', {
          resourceType: item.resourceType,
          resourceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // No conflict detected or couldn't check - proceed with update
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

    try {
      // Delete on server
      await this.medplumClient.deleteResource(item.resourceType, item.resource.id);
    } catch (error) {
      // If resource doesn't exist (404), treat as success - it's already deleted
      if (error instanceof Error && error.message.includes('404')) {
        logger.info('Resource already deleted on server', {
          resourceType: item.resourceType,
          id: item.resource.id
        });
      } else {
        throw error;
      }
    }

    // Clear from local cache after successful delete
    if (!isSyncOnlyType(item.resourceType)) {
      await this.clearLocalCache(item.resourceType as CacheableResourceType, item.resource.id);
    }
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
   * Clear resource from local cache after delete
   */
  private async clearLocalCache(resourceType: CacheableResourceType, id: string): Promise<void> {
    switch (resourceType) {
      case 'Patient':
        await deleteCachedPatient(id);
        break;
      // Note: Add delete functions for other resource types as needed
      // For now, other types will naturally age out of cache
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
