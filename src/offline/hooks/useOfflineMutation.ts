import { useCallback } from 'react';
import { useMedplum } from '@medplum/react';
import { Resource } from '@medplum/fhirtypes';
import { SyncQueue } from '../sync/SyncQueue';
import {
  generateLocalId,
  cachePatient,
  cacheEncounter,
  cacheObservation,
  cacheMedicationRequest,
  cacheServiceRequest,
  cacheDocumentReference,
} from '../db/operations';
import { CacheableResourceType, OfflineMutationResult, OfflineMutationOptions } from '../types';
import { useOfflineStatus } from './useOfflineStatus';

/**
 * Check if an error is a network error
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('connection') ||
      message.includes('offline') ||
      message.includes('timeout')
    );
  }
  return false;
}

/**
 * Cache a resource locally based on its type
 */
async function cacheResourceLocally(
  resourceType: CacheableResourceType,
  resource: Resource,
  isOfflineCreated: boolean
): Promise<void> {
  switch (resourceType) {
    case 'Patient':
      await cachePatient(resource as Parameters<typeof cachePatient>[0], isOfflineCreated);
      break;
    case 'Encounter':
      await cacheEncounter(resource as Parameters<typeof cacheEncounter>[0], isOfflineCreated);
      break;
    case 'Observation':
      await cacheObservation(resource as Parameters<typeof cacheObservation>[0], isOfflineCreated);
      break;
    case 'MedicationRequest':
      await cacheMedicationRequest(resource as Parameters<typeof cacheMedicationRequest>[0], isOfflineCreated);
      break;
    case 'ServiceRequest':
      await cacheServiceRequest(resource as Parameters<typeof cacheServiceRequest>[0], isOfflineCreated);
      break;
    case 'DocumentReference':
      await cacheDocumentReference(resource as Parameters<typeof cacheDocumentReference>[0], isOfflineCreated);
      break;
  }
}

/**
 * Hook for performing mutations that work offline
 * Automatically queues operations when offline or on network error
 */
export function useOfflineMutation(options: OfflineMutationOptions = {}) {
  const medplum = useMedplum();
  const { isOnline, refreshPendingCount } = useOfflineStatus();
  const { cacheLocally = true } = options;

  /**
   * Create a resource - works online or offline
   */
  const createResource = useCallback(
    async <T extends Resource>(
      resource: T,
      resourceType?: CacheableResourceType
    ): Promise<OfflineMutationResult<T>> => {
      const type = (resourceType || resource.resourceType) as CacheableResourceType;

      // If online, try to create on server
      if (isOnline) {
        try {
          const created = await medplum.createResource(resource);

          // Cache locally for offline access
          if (cacheLocally) {
            await cacheResourceLocally(type, created, false);
          }

          await refreshPendingCount();

          return {
            resource: created as T,
            isQueued: false,
          };
        } catch (error) {
          // If network error, queue for later
          if (isNetworkError(error)) {
            return queueCreateOperation(resource, type);
          }
          // Re-throw non-network errors
          throw error;
        }
      }

      // Offline - queue for later
      return queueCreateOperation(resource, type);
    },
    [isOnline, medplum, cacheLocally, refreshPendingCount]
  );

  /**
   * Queue a create operation for later sync
   */
  const queueCreateOperation = async <T extends Resource>(
    resource: T,
    resourceType: CacheableResourceType
  ): Promise<OfflineMutationResult<T>> => {
    // Generate local ID
    const localId = generateLocalId();
    const resourceWithId = { ...resource, id: localId } as T;

    // Cache locally
    if (cacheLocally) {
      await cacheResourceLocally(resourceType, resourceWithId, true);
    }

    // Add to sync queue
    await SyncQueue.queueCreate(resourceType, resourceWithId, localId);

    await refreshPendingCount();

    return {
      resource: resourceWithId,
      isQueued: true,
      localId,
    };
  };

  /**
   * Update a resource - works online or offline
   */
  const updateResource = useCallback(
    async <T extends Resource>(
      resource: T,
      resourceType?: CacheableResourceType
    ): Promise<OfflineMutationResult<T>> => {
      const type = (resourceType || resource.resourceType) as CacheableResourceType;

      // If online, try to update on server
      if (isOnline) {
        try {
          const updated = await medplum.updateResource(resource);

          // Update local cache
          if (cacheLocally) {
            await cacheResourceLocally(type, updated, false);
          }

          await refreshPendingCount();

          return {
            resource: updated as T,
            isQueued: false,
          };
        } catch (error) {
          // If network error, queue for later
          if (isNetworkError(error)) {
            return queueUpdateOperation(resource, type);
          }
          throw error;
        }
      }

      // Offline - queue for later
      return queueUpdateOperation(resource, type);
    },
    [isOnline, medplum, cacheLocally, refreshPendingCount]
  );

  /**
   * Queue an update operation for later sync
   */
  const queueUpdateOperation = async <T extends Resource>(
    resource: T,
    resourceType: CacheableResourceType
  ): Promise<OfflineMutationResult<T>> => {
    // Cache locally
    if (cacheLocally) {
      await cacheResourceLocally(resourceType, resource, false);
    }

    // Add to sync queue
    await SyncQueue.queueUpdate(resourceType, resource);

    await refreshPendingCount();

    return {
      resource,
      isQueued: true,
    };
  };

  /**
   * Delete a resource - works online or offline
   */
  const deleteResource = useCallback(
    async (
      resourceType: CacheableResourceType,
      id: string
    ): Promise<{ isQueued: boolean }> => {
      // If online, try to delete on server
      if (isOnline) {
        try {
          await medplum.deleteResource(resourceType, id);
          await refreshPendingCount();
          return { isQueued: false };
        } catch (error) {
          // If network error, queue for later
          if (isNetworkError(error)) {
            await SyncQueue.queueDelete(resourceType, { resourceType, id } as Resource);
            await refreshPendingCount();
            return { isQueued: true };
          }
          throw error;
        }
      }

      // Offline - queue for later
      await SyncQueue.queueDelete(resourceType, { resourceType, id } as Resource);
      await refreshPendingCount();
      return { isQueued: true };
    },
    [isOnline, medplum, refreshPendingCount]
  );

  return {
    createResource,
    updateResource,
    deleteResource,
    isOnline,
  };
}
