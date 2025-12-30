import { Patient, Encounter, Observation, MedicationRequest, ServiceRequest, DocumentReference, Resource } from '@medplum/fhirtypes';
import { getDB } from './schema';
import {
  CachedPatient,
  CachedEncounter,
  CachedObservation,
  CachedMedicationRequest,
  CachedServiceRequest,
  CachedDocumentReference,
  SyncQueueItem,
  OfflineMetadata,
  LocalIdMapping,
  CacheableResourceType,
  SyncableResourceType,
  SyncStatus,
  DEFAULT_SYNC_CONFIG,
} from '../types';

// ==================== PATIENT OPERATIONS ====================

/**
 * Cache a patient for offline access
 */
export async function cachePatient(patient: Patient, isOfflineCreated = false): Promise<void> {
  const db = await getDB();
  const cached: CachedPatient = {
    resource: patient,
    _lastSynced: Date.now(),
    _isOfflineCreated: isOfflineCreated,
  };
  await db.put('patients', cached);
}

/**
 * Get a cached patient by ID
 */
export async function getCachedPatient(id: string): Promise<Patient | null> {
  const db = await getDB();
  const cached = await db.get('patients', id);
  return cached?.resource ?? null;
}

/**
 * Get all cached patients
 */
export async function getAllCachedPatients(): Promise<Patient[]> {
  const db = await getDB();
  const cached = await db.getAll('patients');
  return cached.map((c) => c.resource);
}

/**
 * Get recently accessed patients (for offline display)
 */
export async function getRecentPatients(limit = 50): Promise<Patient[]> {
  const db = await getDB();
  const index = db.transaction('patients').store.index('by-lastSynced');
  const cached: CachedPatient[] = [];

  let cursor = await index.openCursor(null, 'prev');
  while (cursor && cached.length < limit) {
    cached.push(cursor.value);
    cursor = await cursor.continue();
  }

  return cached.map((c) => c.resource);
}

/**
 * Delete a cached patient
 */
export async function deleteCachedPatient(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('patients', id);
}

// ==================== ENCOUNTER OPERATIONS ====================

/**
 * Cache an encounter for offline access
 */
export async function cacheEncounter(encounter: Encounter, isOfflineCreated = false): Promise<void> {
  const db = await getDB();
  const cached: CachedEncounter = {
    resource: encounter,
    _lastSynced: Date.now(),
    _isOfflineCreated: isOfflineCreated,
  };
  await db.put('encounters', cached);
}

/**
 * Get a cached encounter by ID
 */
export async function getCachedEncounter(id: string): Promise<Encounter | null> {
  const db = await getDB();
  const cached = await db.get('encounters', id);
  return cached?.resource ?? null;
}

/**
 * Get all encounters for a patient
 */
export async function getEncountersByPatient(patientId: string): Promise<Encounter[]> {
  const db = await getDB();
  const patientRef = `Patient/${patientId}`;
  const cached = await db.getAllFromIndex('encounters', 'by-patient', patientRef);
  return cached.map((c) => c.resource);
}

// ==================== OBSERVATION OPERATIONS ====================

/**
 * Cache an observation for offline access
 */
export async function cacheObservation(observation: Observation, isOfflineCreated = false): Promise<void> {
  const db = await getDB();
  const cached: CachedObservation = {
    resource: observation,
    _lastSynced: Date.now(),
    _isOfflineCreated: isOfflineCreated,
  };
  await db.put('observations', cached);
}

/**
 * Get a cached observation by ID
 */
export async function getCachedObservation(id: string): Promise<Observation | null> {
  const db = await getDB();
  const cached = await db.get('observations', id);
  return cached?.resource ?? null;
}

/**
 * Get all observations for a patient
 */
export async function getObservationsByPatient(patientId: string): Promise<Observation[]> {
  const db = await getDB();
  const patientRef = `Patient/${patientId}`;
  const cached = await db.getAllFromIndex('observations', 'by-patient', patientRef);
  return cached.map((c) => c.resource);
}

/**
 * Get all observations for an encounter
 */
export async function getObservationsByEncounter(encounterId: string): Promise<Observation[]> {
  const db = await getDB();
  const encounterRef = `Encounter/${encounterId}`;
  const cached = await db.getAllFromIndex('observations', 'by-encounter', encounterRef);
  return cached.map((c) => c.resource);
}

// ==================== MEDICATION REQUEST OPERATIONS ====================

/**
 * Cache a medication request for offline access
 */
export async function cacheMedicationRequest(
  medicationRequest: MedicationRequest,
  isOfflineCreated = false
): Promise<void> {
  const db = await getDB();
  const cached: CachedMedicationRequest = {
    resource: medicationRequest,
    _lastSynced: Date.now(),
    _isOfflineCreated: isOfflineCreated,
  };
  await db.put('medicationRequests', cached);
}

/**
 * Get a cached medication request by ID
 */
export async function getCachedMedicationRequest(id: string): Promise<MedicationRequest | null> {
  const db = await getDB();
  const cached = await db.get('medicationRequests', id);
  return cached?.resource ?? null;
}

/**
 * Get all medication requests for a patient
 */
export async function getMedicationRequestsByPatient(patientId: string): Promise<MedicationRequest[]> {
  const db = await getDB();
  const patientRef = `Patient/${patientId}`;
  const cached = await db.getAllFromIndex('medicationRequests', 'by-patient', patientRef);
  return cached.map((c) => c.resource);
}

// ==================== SERVICE REQUEST OPERATIONS ====================

/**
 * Cache a service request for offline access
 */
export async function cacheServiceRequest(serviceRequest: ServiceRequest, isOfflineCreated = false): Promise<void> {
  const db = await getDB();
  const cached: CachedServiceRequest = {
    resource: serviceRequest,
    _lastSynced: Date.now(),
    _isOfflineCreated: isOfflineCreated,
  };
  await db.put('serviceRequests', cached);
}

/**
 * Get a cached service request by ID
 */
export async function getCachedServiceRequest(id: string): Promise<ServiceRequest | null> {
  const db = await getDB();
  const cached = await db.get('serviceRequests', id);
  return cached?.resource ?? null;
}

/**
 * Get all service requests for a patient
 */
export async function getServiceRequestsByPatient(patientId: string): Promise<ServiceRequest[]> {
  const db = await getDB();
  const patientRef = `Patient/${patientId}`;
  const cached = await db.getAllFromIndex('serviceRequests', 'by-patient', patientRef);
  return cached.map((c) => c.resource);
}

// ==================== DOCUMENT REFERENCE OPERATIONS ====================

/**
 * Cache a document reference for offline access
 */
export async function cacheDocumentReference(
  documentReference: DocumentReference,
  isOfflineCreated = false
): Promise<void> {
  const db = await getDB();
  const cached: CachedDocumentReference = {
    resource: documentReference,
    _lastSynced: Date.now(),
    _isOfflineCreated: isOfflineCreated,
  };
  await db.put('documentReferences', cached);
}

/**
 * Get a cached document reference by ID
 */
export async function getCachedDocumentReference(id: string): Promise<DocumentReference | null> {
  const db = await getDB();
  const cached = await db.get('documentReferences', id);
  return cached?.resource ?? null;
}

// ==================== SYNC QUEUE OPERATIONS ====================

/**
 * Generate a unique local ID for offline-created resources
 */
export function generateLocalId(): string {
  return `offline-${crypto.randomUUID()}`;
}

/**
 * Add an item to the sync queue
 * Supports both cacheable resources and sync-only resources like DetectedIssue
 */
export async function addToSyncQueue(
  operation: 'create' | 'update' | 'delete',
  resourceType: SyncableResourceType,
  resource: Resource,
  localId?: string
): Promise<SyncQueueItem> {
  const db = await getDB();
  const item: SyncQueueItem = {
    id: crypto.randomUUID(),
    operation,
    resourceType,
    resource,
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: DEFAULT_SYNC_CONFIG.maxRetries,
    status: 'pending',
    localId,
  };
  await db.put('syncQueue', item);
  return item;
}

/**
 * Get pending items from the sync queue
 */
export async function getPendingSyncItems(limit?: number): Promise<SyncQueueItem[]> {
  const db = await getDB();
  const index = db.transaction('syncQueue').store.index('by-createdAt');
  const items: SyncQueueItem[] = [];

  let cursor = await index.openCursor();
  while (cursor) {
    if (cursor.value.status === 'pending' || cursor.value.status === 'failed') {
      items.push(cursor.value);
      if (limit && items.length >= limit) {
        break;
      }
    }
    cursor = await cursor.continue();
  }

  return items;
}

/**
 * Get count of pending sync items
 */
export async function getPendingSyncCount(): Promise<number> {
  const db = await getDB();
  const all = await db.getAllFromIndex('syncQueue', 'by-status', 'pending');
  const failed = await db.getAllFromIndex('syncQueue', 'by-status', 'failed');
  return all.length + failed.length;
}

/**
 * Update sync queue item status
 */
export async function updateSyncItemStatus(
  id: string,
  status: SyncStatus,
  error?: string,
  serverId?: string
): Promise<void> {
  const db = await getDB();
  const item = await db.get('syncQueue', id);
  if (item) {
    item.status = status;
    if (error) {
      item.error = error;
      item.retryCount++;
    }
    if (serverId) {
      item.serverId = serverId;
    }
    await db.put('syncQueue', item);
  }
}

/**
 * Remove completed sync items
 */
export async function clearCompletedSyncItems(): Promise<void> {
  const db = await getDB();
  const completed = await db.getAllFromIndex('syncQueue', 'by-status', 'completed');
  const tx = db.transaction('syncQueue', 'readwrite');
  await Promise.all(completed.map((item) => tx.store.delete(item.id)));
  await tx.done;
}

/**
 * Get a sync queue item by ID
 */
export async function getSyncItem(id: string): Promise<SyncQueueItem | null> {
  const db = await getDB();
  const item = await db.get('syncQueue', id);
  return item ?? null;
}

// ==================== LOCAL ID MAPPING OPERATIONS ====================

/**
 * Save a mapping from local ID to server ID
 */
export async function saveLocalIdMapping(
  localId: string,
  serverId: string,
  resourceType: CacheableResourceType
): Promise<void> {
  const db = await getDB();
  const mapping: LocalIdMapping = {
    localId,
    serverId,
    resourceType,
    createdAt: Date.now(),
  };
  await db.put('localIdMappings', mapping);
}

/**
 * Get server ID from local ID
 */
export async function getServerIdFromLocalId(localId: string): Promise<string | null> {
  const db = await getDB();
  const mapping = await db.get('localIdMappings', localId);
  return mapping?.serverId ?? null;
}

/**
 * Get local ID from server ID
 */
export async function getLocalIdFromServerId(serverId: string): Promise<string | null> {
  const db = await getDB();
  const mappings = await db.getAllFromIndex('localIdMappings', 'by-serverId', serverId);
  return mappings[0]?.localId ?? null;
}

// ==================== METADATA OPERATIONS ====================

/**
 * Update offline metadata
 */
export async function updateMetadata(updates: Partial<OfflineMetadata>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('metadata', 'main');
  const metadata: OfflineMetadata = {
    key: 'main',
    lastSync: existing?.lastSync ?? 0,
    version: existing?.version ?? 1,
    pendingCount: existing?.pendingCount ?? 0,
    ...updates,
  };
  await db.put('metadata', metadata);
}

/**
 * Get offline metadata
 */
export async function getMetadata(): Promise<OfflineMetadata | null> {
  const db = await getDB();
  return (await db.get('metadata', 'main')) ?? null;
}

// ==================== CLEANUP OPERATIONS ====================

/**
 * Clear stale cached data older than specified age
 */
export async function clearStaleData(maxAgeMs: number): Promise<number> {
  const db = await getDB();
  const cutoff = Date.now() - maxAgeMs;
  let deletedCount = 0;

  const stores = ['patients', 'encounters', 'observations', 'medicationRequests', 'serviceRequests', 'documentReferences'] as const;

  for (const storeName of stores) {
    const tx = db.transaction(storeName, 'readwrite');
    const index = tx.store.index('by-lastSynced');
    let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff));

    while (cursor) {
      // Don't delete offline-created resources that haven't synced
      if (!cursor.value._isOfflineCreated) {
        await cursor.delete();
        deletedCount++;
      }
      cursor = await cursor.continue();
    }

    await tx.done;
  }

  return deletedCount;
}

/**
 * Check if a resource is cached
 */
export async function isResourceCached(resourceType: CacheableResourceType, id: string): Promise<boolean> {
  const db = await getDB();

  switch (resourceType) {
    case 'Patient':
      return (await db.get('patients', id)) !== undefined;
    case 'Encounter':
      return (await db.get('encounters', id)) !== undefined;
    case 'Observation':
      return (await db.get('observations', id)) !== undefined;
    case 'MedicationRequest':
      return (await db.get('medicationRequests', id)) !== undefined;
    case 'ServiceRequest':
      return (await db.get('serviceRequests', id)) !== undefined;
    case 'DocumentReference':
      return (await db.get('documentReferences', id)) !== undefined;
    default:
      return false;
  }
}
