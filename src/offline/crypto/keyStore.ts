/**
 * Key management for offline encryption
 *
 * Manages the lifecycle of encryption keys:
 * - Derivation from session token
 * - In-memory storage (never persisted)
 * - Salt storage in IndexedDB (required for key re-derivation)
 * - Cleanup on logout
 */

import { deriveEncryptionKey, generateSalt, isEncryptionSupported } from './encryption';
import { logger } from '../../utils/logger';

/**
 * Salt storage key in IndexedDB metadata
 */
const SALT_STORAGE_KEY = 'encryption_salt';

/**
 * In-memory encryption key (never persisted to disk)
 * Cleared on page unload and logout
 */
let encryptionKey: CryptoKey | null = null;

/**
 * Salt used for key derivation (stored in IndexedDB)
 */
let encryptionSalt: Uint8Array | null = null;

/**
 * Whether encryption has been initialized this session
 */
let isInitialized = false;

/**
 * Store salt in IndexedDB for persistence across sessions
 */
async function storeSalt(salt: Uint8Array): Promise<void> {
  // Use a simple dedicated store for encryption metadata
  const request = indexedDB.open('hopeemr-encryption', 1);

  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata');
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');

      // Store salt as array for IndexedDB compatibility
      store.put(Array.from(salt), SALT_STORAGE_KEY);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

/**
 * Retrieve salt from IndexedDB
 */
async function retrieveSalt(): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('hopeemr-encryption', 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata');
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const getRequest = store.get(SALT_STORAGE_KEY);

      getRequest.onsuccess = () => {
        db.close();
        if (getRequest.result) {
          resolve(new Uint8Array(getRequest.result));
        } else {
          resolve(null);
        }
      };

      getRequest.onerror = () => {
        db.close();
        reject(getRequest.error);
      };
    };
  });
}

/**
 * Initialize encryption with a session token
 *
 * This should be called when the user logs in or when the app loads
 * with an existing session. The key is derived from the session token
 * and stored in memory only.
 *
 * @param sessionToken - The user's session/access token from Medplum
 * @throws Error if encryption is not supported or initialization fails
 */
export async function initializeEncryption(sessionToken: string): Promise<void> {
  if (!isEncryptionSupported()) {
    throw new Error('Encryption is not supported in this environment');
  }

  if (!sessionToken) {
    throw new Error('Session token is required for encryption initialization');
  }

  try {
    // Try to retrieve existing salt, or generate new one
    let salt = await retrieveSalt();

    if (!salt) {
      // First time setup - generate and store new salt
      salt = generateSalt();
      await storeSalt(salt);
      logger.info('Generated new encryption salt');
    }

    encryptionSalt = salt;

    // Derive key from session token and salt
    encryptionKey = await deriveEncryptionKey(sessionToken, salt);
    isInitialized = true;

    logger.info('Encryption initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize encryption', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get the current encryption key
 *
 * @returns The CryptoKey for encryption/decryption
 * @throws Error if encryption has not been initialized
 */
export function getEncryptionKey(): CryptoKey {
  if (!encryptionKey) {
    throw new Error(
      'Encryption not initialized. Call initializeEncryption() first.'
    );
  }
  return encryptionKey;
}

/**
 * Check if encryption is ready to use
 */
export function isEncryptionReady(): boolean {
  return isInitialized && encryptionKey !== null;
}

/**
 * Clear encryption key from memory
 *
 * Should be called on logout to ensure PHI cannot be decrypted
 * after the user's session ends.
 */
export function clearEncryptionKey(): void {
  encryptionKey = null;
  encryptionSalt = null;
  isInitialized = false;
  logger.info('Encryption key cleared');
}

/**
 * Clear all encryption data including stored salt
 *
 * This is a more aggressive cleanup that requires re-encryption
 * of all data on next login. Use when you want to completely
 * reset the encryption state.
 */
export async function clearAllEncryptionData(): Promise<void> {
  clearEncryptionKey();

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('hopeemr-encryption');
    request.onsuccess = () => {
      logger.info('Encryption database cleared');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Re-initialize encryption with a new session token
 *
 * Used when the session token changes (e.g., token refresh).
 * The same salt is used, so existing encrypted data can still be decrypted
 * as long as the user identity is the same.
 *
 * Note: If the user changes, encrypted data will become inaccessible
 * (which is the intended security behavior).
 */
export async function reinitializeEncryption(newSessionToken: string): Promise<void> {
  // Clear current key but keep salt
  encryptionKey = null;
  isInitialized = false;

  // Re-derive with new token (same salt)
  await initializeEncryption(newSessionToken);
}
