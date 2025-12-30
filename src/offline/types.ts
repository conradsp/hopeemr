import { Resource, Patient, Encounter, Observation, MedicationRequest, ServiceRequest, DocumentReference, DetectedIssue } from '@medplum/fhirtypes';

/**
 * Supported FHIR resource types for offline caching
 */
export type CacheableResourceType =
  | 'Patient'
  | 'Encounter'
  | 'Observation'
  | 'MedicationRequest'
  | 'ServiceRequest'
  | 'DocumentReference';

/**
 * Resource types that can be synced but not cached
 * (e.g., audit records that don't need offline viewing)
 */
export type SyncOnlyResourceType = 'DetectedIssue';

/**
 * All resource types that can be queued for sync
 */
export type SyncableResourceType = CacheableResourceType | SyncOnlyResourceType;

/**
 * Base interface for cached resources with sync metadata
 */
export interface CachedResource<T extends Resource = Resource> {
  resource: T;
  _lastSynced: number;
  _localId?: string; // For offline-created resources
  _isOfflineCreated?: boolean;
}

/**
 * Typed cached resources
 */
export type CachedPatient = CachedResource<Patient>;
export type CachedEncounter = CachedResource<Encounter>;
export type CachedObservation = CachedResource<Observation>;
export type CachedMedicationRequest = CachedResource<MedicationRequest>;
export type CachedServiceRequest = CachedResource<ServiceRequest>;
export type CachedDocumentReference = CachedResource<DocumentReference>;

/**
 * Sync queue item representing a pending operation
 */
export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  resourceType: SyncableResourceType;
  resource: Resource;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  status: SyncStatus;
  error?: string;
  localId?: string; // Temporary ID for offline-created resources
  serverId?: string; // Server-assigned ID after sync
}

/**
 * Status of a sync queue item
 */
export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed';

/**
 * Metadata stored in IndexedDB
 */
export interface OfflineMetadata {
  key: string;
  lastSync: number;
  version: number;
  pendingCount: number;
}

/**
 * Local ID mapping for offline-created resources
 */
export interface LocalIdMapping {
  localId: string;
  serverId: string;
  resourceType: CacheableResourceType;
  createdAt: number;
}

/**
 * Offline context value provided to React components
 */
export interface OfflineContextValue {
  /** Whether the device has network connectivity */
  isOnline: boolean;
  /** Number of pending changes waiting to sync */
  pendingChanges: number;
  /** Timestamp of last successful sync */
  lastSyncTime: Date | null;
  /** Whether sync is currently in progress */
  isSyncing: boolean;
  /** Trigger manual sync */
  syncNow: () => Promise<void>;
  /** Check if a resource is available offline */
  isResourceCached: (resourceType: CacheableResourceType, id: string) => Promise<boolean>;
}

/**
 * Result of an offline mutation operation
 */
export interface OfflineMutationResult<T extends Resource = Resource> {
  /** The resource (may have temporary ID if created offline) */
  resource: T;
  /** Whether the operation was queued for later sync */
  isQueued: boolean;
  /** Temporary local ID if created offline */
  localId?: string;
}

/**
 * Options for offline mutation hook
 */
export interface OfflineMutationOptions {
  /** Whether to show notification on queue */
  showQueueNotification?: boolean;
  /** Whether to cache the resource locally */
  cacheLocally?: boolean;
}

/**
 * Sync event types for event emitter
 */
export type SyncEventType =
  | 'sync:start'
  | 'sync:complete'
  | 'sync:error'
  | 'sync:item:success'
  | 'sync:item:error'
  | 'connection:online'
  | 'connection:offline';

/**
 * Sync event payload
 */
export interface SyncEvent {
  type: SyncEventType;
  timestamp: number;
  data?: {
    itemId?: string;
    resourceType?: CacheableResourceType;
    error?: string;
    pendingCount?: number;
  };
}

/**
 * Sync manager configuration
 */
export interface SyncManagerConfig {
  /** Maximum number of retries for failed sync */
  maxRetries: number;
  /** Base delay for exponential backoff (ms) */
  baseRetryDelay: number;
  /** Maximum delay between retries (ms) */
  maxRetryDelay: number;
  /** Batch size for sync operations */
  batchSize: number;
  /** Auto-sync when connection restored */
  autoSyncOnReconnect: boolean;
}

/**
 * Default sync manager configuration
 */
export const DEFAULT_SYNC_CONFIG: SyncManagerConfig = {
  maxRetries: 5,
  baseRetryDelay: 1000, // 1 second
  maxRetryDelay: 60000, // 1 minute
  batchSize: 10,
  autoSyncOnReconnect: true,
};

/**
 * Conflict resolution strategy
 */
export type ConflictResolution = 'server-wins' | 'client-wins' | 'manual';

/**
 * Conflict information when server and local versions differ
 */
export interface SyncConflict {
  localResource: Resource;
  serverResource: Resource;
  resolution?: ConflictResolution;
  resolvedAt?: number;
}
