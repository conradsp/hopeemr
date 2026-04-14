/**
 * Encrypted cache operations for PHI protection
 *
 * These functions wrap the standard cache operations to add
 * AES-256-GCM encryption before storing and decryption when reading.
 */

import { Patient, Encounter, Observation, MedicationRequest, ServiceRequest, DocumentReference, Resource } from '@medplum/fhirtypes';
import { getDB } from '../db/schema';
import { encryptData, decryptData, EncryptedData } from './encryption';
import { getEncryptionKey, isEncryptionReady } from './keyStore';
import {
  EncryptedCachedResource,
  CacheableResourceType,
} from '../types';
import { logger } from '../../utils/logger';

/**
 * Type guard to check if a cached item is encrypted
 * Checks for the presence of _encrypted flag and encryptedResource
 */
function isEncrypted(item: unknown): item is EncryptedCachedResource {
  return (
    typeof item === 'object' &&
    item !== null &&
    '_encrypted' in item &&
    (item as EncryptedCachedResource)._encrypted === true &&
    'encryptedResource' in item
  );
}

// ==================== GENERIC ENCRYPTED OPERATIONS ====================

/**
 * Cache any resource with encryption
 */
async function cacheResourceEncrypted<T extends Resource>(
  storeName: 'patients' | 'encounters' | 'observations' | 'medicationRequests' | 'serviceRequests' | 'documentReferences',
  resourceType: CacheableResourceType,
  resource: T,
  isOfflineCreated = false
): Promise<void> {
  if (!isEncryptionReady()) {
    throw new Error('Encryption not initialized');
  }

  const key = getEncryptionKey();
  const encrypted = await encryptData(resource, key);

  const cached: EncryptedCachedResource = {
    encryptedResource: encrypted,
    _resourceId: resource.id || '',
    _resourceType: resourceType,
    _lastSynced: Date.now(),
    _isOfflineCreated: isOfflineCreated,
    _versionId: resource.meta?.versionId,
    _encrypted: true,
  };

  const db = await getDB();
  // Use type assertion since we're storing encrypted format which differs from schema type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.put(storeName, cached as any);
}

/**
 * Get a cached resource with decryption
 */
async function getCachedResourceEncrypted<T extends Resource>(
  storeName: 'patients' | 'encounters' | 'observations' | 'medicationRequests' | 'serviceRequests' | 'documentReferences',
  id: string
): Promise<T | null> {
  if (!isEncryptionReady()) {
    throw new Error('Encryption not initialized');
  }

  const db = await getDB();
  const cached = await db.get(storeName, id);

  if (!cached) {
    return null;
  }

  // Handle both encrypted and legacy unencrypted data
  if (isEncrypted(cached)) {
    const key = getEncryptionKey();
    return decryptData<T>(cached.encryptedResource as EncryptedData, key);
  } else {
    // Legacy unencrypted data - return as-is but log warning
    logger.warn('Retrieved unencrypted cached resource - migration may be needed', {
      storeName,
      id,
    });
    return (cached as unknown as { resource: T }).resource;
  }
}

/**
 * Get all cached resources with decryption
 */
async function getAllCachedResourcesEncrypted<T extends Resource>(
  storeName: 'patients' | 'encounters' | 'observations' | 'medicationRequests' | 'serviceRequests' | 'documentReferences'
): Promise<T[]> {
  if (!isEncryptionReady()) {
    throw new Error('Encryption not initialized');
  }

  const db = await getDB();
  const allCached = await db.getAll(storeName);
  const key = getEncryptionKey();
  const results: T[] = [];

  for (const cached of allCached) {
    try {
      if (isEncrypted(cached)) {
        const resource = await decryptData<T>(cached.encryptedResource as EncryptedData, key);
        results.push(resource);
      } else {
        // Legacy unencrypted data
        results.push((cached as unknown as { resource: T }).resource);
      }
    } catch (error) {
      logger.error('Failed to decrypt cached resource', {
        storeName,
        error: error instanceof Error ? error.message : String(error),
      });
      // Skip corrupted/undecryptable resources
    }
  }

  return results;
}

// ==================== PATIENT OPERATIONS ====================

export async function cachePatientEncrypted(patient: Patient, isOfflineCreated = false): Promise<void> {
  await cacheResourceEncrypted('patients', 'Patient', patient, isOfflineCreated);
}

export async function getCachedPatientEncrypted(id: string): Promise<Patient | null> {
  return getCachedResourceEncrypted<Patient>('patients', id);
}

export async function getAllCachedPatientsEncrypted(): Promise<Patient[]> {
  return getAllCachedResourcesEncrypted<Patient>('patients');
}

export async function getRecentPatientsEncrypted(limit = 50): Promise<Patient[]> {
  if (!isEncryptionReady()) {
    throw new Error('Encryption not initialized');
  }

  const db = await getDB();
  const index = db.transaction('patients').store.index('by-lastSynced');
  const key = getEncryptionKey();
  const results: Patient[] = [];

  let cursor = await index.openCursor(null, 'prev');
  while (cursor && results.length < limit) {
    try {
      const cached = cursor.value;
      if (isEncrypted(cached)) {
        const patient = await decryptData<Patient>(cached.encryptedResource as EncryptedData, key);
        results.push(patient);
      } else {
        results.push((cached as unknown as { resource: Patient }).resource);
      }
    } catch (error) {
      logger.error('Failed to decrypt patient', { error });
    }
    cursor = await cursor.continue();
  }

  return results;
}

// ==================== ENCOUNTER OPERATIONS ====================

export async function cacheEncounterEncrypted(encounter: Encounter, isOfflineCreated = false): Promise<void> {
  await cacheResourceEncrypted('encounters', 'Encounter', encounter, isOfflineCreated);
}

export async function getCachedEncounterEncrypted(id: string): Promise<Encounter | null> {
  return getCachedResourceEncrypted<Encounter>('encounters', id);
}

export async function getEncountersByPatientEncrypted(patientId: string): Promise<Encounter[]> {
  const allEncounters = await getAllCachedResourcesEncrypted<Encounter>('encounters');
  const patientRef = `Patient/${patientId}`;
  return allEncounters.filter(e => e.subject?.reference === patientRef);
}

// ==================== OBSERVATION OPERATIONS ====================

export async function cacheObservationEncrypted(observation: Observation, isOfflineCreated = false): Promise<void> {
  await cacheResourceEncrypted('observations', 'Observation', observation, isOfflineCreated);
}

export async function getCachedObservationEncrypted(id: string): Promise<Observation | null> {
  return getCachedResourceEncrypted<Observation>('observations', id);
}

export async function getObservationsByPatientEncrypted(patientId: string): Promise<Observation[]> {
  const allObservations = await getAllCachedResourcesEncrypted<Observation>('observations');
  const patientRef = `Patient/${patientId}`;
  return allObservations.filter(o => o.subject?.reference === patientRef);
}

export async function getObservationsByEncounterEncrypted(encounterId: string): Promise<Observation[]> {
  const allObservations = await getAllCachedResourcesEncrypted<Observation>('observations');
  const encounterRef = `Encounter/${encounterId}`;
  return allObservations.filter(o => o.encounter?.reference === encounterRef);
}

// ==================== MEDICATION REQUEST OPERATIONS ====================

export async function cacheMedicationRequestEncrypted(
  medicationRequest: MedicationRequest,
  isOfflineCreated = false
): Promise<void> {
  await cacheResourceEncrypted('medicationRequests', 'MedicationRequest', medicationRequest, isOfflineCreated);
}

export async function getCachedMedicationRequestEncrypted(id: string): Promise<MedicationRequest | null> {
  return getCachedResourceEncrypted<MedicationRequest>('medicationRequests', id);
}

export async function getMedicationRequestsByPatientEncrypted(patientId: string): Promise<MedicationRequest[]> {
  const allMedRequests = await getAllCachedResourcesEncrypted<MedicationRequest>('medicationRequests');
  const patientRef = `Patient/${patientId}`;
  return allMedRequests.filter(mr => mr.subject?.reference === patientRef);
}

// ==================== SERVICE REQUEST OPERATIONS ====================

export async function cacheServiceRequestEncrypted(
  serviceRequest: ServiceRequest,
  isOfflineCreated = false
): Promise<void> {
  await cacheResourceEncrypted('serviceRequests', 'ServiceRequest', serviceRequest, isOfflineCreated);
}

export async function getCachedServiceRequestEncrypted(id: string): Promise<ServiceRequest | null> {
  return getCachedResourceEncrypted<ServiceRequest>('serviceRequests', id);
}

export async function getServiceRequestsByPatientEncrypted(patientId: string): Promise<ServiceRequest[]> {
  const allServiceRequests = await getAllCachedResourcesEncrypted<ServiceRequest>('serviceRequests');
  const patientRef = `Patient/${patientId}`;
  return allServiceRequests.filter(sr => sr.subject?.reference === patientRef);
}

// ==================== DOCUMENT REFERENCE OPERATIONS ====================

export async function cacheDocumentReferenceEncrypted(
  documentReference: DocumentReference,
  isOfflineCreated = false
): Promise<void> {
  await cacheResourceEncrypted('documentReferences', 'DocumentReference', documentReference, isOfflineCreated);
}

export async function getCachedDocumentReferenceEncrypted(id: string): Promise<DocumentReference | null> {
  return getCachedResourceEncrypted<DocumentReference>('documentReferences', id);
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get the cached version ID for a resource (for conflict detection)
 * Works with both encrypted and unencrypted cached data
 */
export async function getCachedVersionIdEncrypted(
  resourceType: CacheableResourceType,
  id: string
): Promise<string | undefined> {
  const db = await getDB();

  const storeMap: Record<CacheableResourceType, string> = {
    Patient: 'patients',
    Encounter: 'encounters',
    Observation: 'observations',
    MedicationRequest: 'medicationRequests',
    ServiceRequest: 'serviceRequests',
    DocumentReference: 'documentReferences',
  };

  const storeName = storeMap[resourceType];
  if (!storeName) return undefined;

  const cached = await db.get(storeName as 'patients', id);
  return cached?._versionId;
}

/**
 * Check if a resource is cached (works with encrypted data)
 */
export async function isResourceCachedEncrypted(
  resourceType: CacheableResourceType,
  id: string
): Promise<boolean> {
  const db = await getDB();

  const storeMap: Record<CacheableResourceType, string> = {
    Patient: 'patients',
    Encounter: 'encounters',
    Observation: 'observations',
    MedicationRequest: 'medicationRequests',
    ServiceRequest: 'serviceRequests',
    DocumentReference: 'documentReferences',
  };

  const storeName = storeMap[resourceType];
  if (!storeName) return false;

  const cached = await db.get(storeName as 'patients', id);
  return cached !== undefined;
}
