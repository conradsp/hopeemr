import { DBSchema, openDB, IDBPDatabase } from 'idb';
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
} from '../types';

/**
 * IndexedDB schema for offline storage
 */
export interface OfflineDBSchema extends DBSchema {
  patients: {
    key: string;
    value: CachedPatient;
    indexes: {
      'by-lastSynced': number;
    };
  };
  encounters: {
    key: string;
    value: CachedEncounter;
    indexes: {
      'by-patient': string;
      'by-lastSynced': number;
    };
  };
  observations: {
    key: string;
    value: CachedObservation;
    indexes: {
      'by-patient': string;
      'by-encounter': string;
      'by-lastSynced': number;
    };
  };
  medicationRequests: {
    key: string;
    value: CachedMedicationRequest;
    indexes: {
      'by-patient': string;
      'by-encounter': string;
      'by-lastSynced': number;
    };
  };
  serviceRequests: {
    key: string;
    value: CachedServiceRequest;
    indexes: {
      'by-patient': string;
      'by-encounter': string;
      'by-lastSynced': number;
    };
  };
  documentReferences: {
    key: string;
    value: CachedDocumentReference;
    indexes: {
      'by-patient': string;
      'by-lastSynced': number;
    };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: {
      'by-status': string;
      'by-createdAt': number;
    };
  };
  metadata: {
    key: string;
    value: OfflineMetadata;
  };
  localIdMappings: {
    key: string;
    value: LocalIdMapping;
    indexes: {
      'by-serverId': string;
    };
  };
}

const DB_NAME = 'hopeemr-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<OfflineDBSchema> | null = null;

/**
 * Get or create the IndexedDB database instance
 */
export async function getDB(): Promise<IDBPDatabase<OfflineDBSchema>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<OfflineDBSchema>(DB_NAME, DB_VERSION, {
    // Migration ladder — each `if (oldVersion < N)` block runs for any user
    // upgrading past version N. New schema changes append a new block; never
    // mutate an earlier block (existing users have already run it).
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const patientStore = db.createObjectStore('patients', { keyPath: 'resource.id' });
        patientStore.createIndex('by-lastSynced', '_lastSynced');

        const encounterStore = db.createObjectStore('encounters', { keyPath: 'resource.id' });
        encounterStore.createIndex('by-patient', 'resource.subject.reference');
        encounterStore.createIndex('by-lastSynced', '_lastSynced');

        const observationStore = db.createObjectStore('observations', { keyPath: 'resource.id' });
        observationStore.createIndex('by-patient', 'resource.subject.reference');
        observationStore.createIndex('by-encounter', 'resource.encounter.reference');
        observationStore.createIndex('by-lastSynced', '_lastSynced');

        const medReqStore = db.createObjectStore('medicationRequests', { keyPath: 'resource.id' });
        medReqStore.createIndex('by-patient', 'resource.subject.reference');
        medReqStore.createIndex('by-encounter', 'resource.encounter.reference');
        medReqStore.createIndex('by-lastSynced', '_lastSynced');

        const serviceReqStore = db.createObjectStore('serviceRequests', { keyPath: 'resource.id' });
        serviceReqStore.createIndex('by-patient', 'resource.subject.reference');
        serviceReqStore.createIndex('by-encounter', 'resource.encounter.reference');
        serviceReqStore.createIndex('by-lastSynced', '_lastSynced');

        const docRefStore = db.createObjectStore('documentReferences', { keyPath: 'resource.id' });
        docRefStore.createIndex('by-patient', 'resource.subject.reference');
        docRefStore.createIndex('by-lastSynced', '_lastSynced');

        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('by-status', 'status');
        syncStore.createIndex('by-createdAt', 'createdAt');

        db.createObjectStore('metadata', { keyPath: 'key' });

        const mappingStore = db.createObjectStore('localIdMappings', { keyPath: 'localId' });
        mappingStore.createIndex('by-serverId', 'serverId');
      }
    },
  });

  return dbInstance;
}

/**
 * Close the database connection
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Clear all data from the database (for testing or reset)
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['patients', 'encounters', 'observations', 'medicationRequests', 'serviceRequests', 'documentReferences', 'syncQueue', 'metadata', 'localIdMappings'],
    'readwrite'
  );

  await Promise.all([
    tx.objectStore('patients').clear(),
    tx.objectStore('encounters').clear(),
    tx.objectStore('observations').clear(),
    tx.objectStore('medicationRequests').clear(),
    tx.objectStore('serviceRequests').clear(),
    tx.objectStore('documentReferences').clear(),
    tx.objectStore('syncQueue').clear(),
    tx.objectStore('metadata').clear(),
    tx.objectStore('localIdMappings').clear(),
  ]);

  await tx.done;
}
