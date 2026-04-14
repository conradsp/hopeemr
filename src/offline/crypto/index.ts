/**
 * Encryption module exports
 */

// Core encryption functions
export {
  encryptData,
  decryptData,
  deriveEncryptionKey,
  generateSalt,
  isEncryptionSupported,
  type EncryptedData,
} from './encryption';

// Key management
export {
  initializeEncryption,
  getEncryptionKey,
  isEncryptionReady,
  clearEncryptionKey,
  clearAllEncryptionData,
  reinitializeEncryption,
} from './keyStore';

// Encrypted cache operations
export {
  // Patient
  cachePatientEncrypted,
  getCachedPatientEncrypted,
  getAllCachedPatientsEncrypted,
  getRecentPatientsEncrypted,
  // Encounter
  cacheEncounterEncrypted,
  getCachedEncounterEncrypted,
  getEncountersByPatientEncrypted,
  // Observation
  cacheObservationEncrypted,
  getCachedObservationEncrypted,
  getObservationsByPatientEncrypted,
  getObservationsByEncounterEncrypted,
  // MedicationRequest
  cacheMedicationRequestEncrypted,
  getCachedMedicationRequestEncrypted,
  getMedicationRequestsByPatientEncrypted,
  // ServiceRequest
  cacheServiceRequestEncrypted,
  getCachedServiceRequestEncrypted,
  getServiceRequestsByPatientEncrypted,
  // DocumentReference
  cacheDocumentReferenceEncrypted,
  getCachedDocumentReferenceEncrypted,
  // Utilities
  getCachedVersionIdEncrypted,
  isResourceCachedEncrypted,
} from './encryptedOperations';
