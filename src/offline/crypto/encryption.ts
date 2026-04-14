/**
 * Encryption utilities for PHI protection in IndexedDB
 * Uses AES-256-GCM (Authenticated Encryption with Associated Data)
 */

import { logger } from '../../utils/logger';

/**
 * Encrypted data structure stored in IndexedDB
 */
export interface EncryptedData {
  /** Base64-encoded initialization vector (12 bytes for GCM) */
  iv: string;
  /** Base64-encoded ciphertext */
  ciphertext: string;
}

/**
 * Configuration for key derivation
 */
const KEY_DERIVATION_CONFIG = {
  algorithm: 'PBKDF2',
  hash: 'SHA-256',
  iterations: 100000, // OWASP recommended minimum
  keyLength: 256, // AES-256
};

/**
 * Configuration for encryption
 */
const ENCRYPTION_CONFIG = {
  algorithm: 'AES-GCM',
  ivLength: 12, // 96 bits recommended for GCM
  tagLength: 128, // Authentication tag length in bits
};

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a random initialization vector
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));
}

/**
 * Generate a salt for key derivation
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Derive an encryption key from a password/token using PBKDF2
 *
 * @param password - The password or token to derive from
 * @param salt - Salt for key derivation (should be stored and reused)
 * @returns A CryptoKey suitable for AES-GCM encryption
 */
export async function deriveEncryptionKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Import the password as a key
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    KEY_DERIVATION_CONFIG.algorithm,
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive the actual encryption key
  const key = await crypto.subtle.deriveKey(
    {
      name: KEY_DERIVATION_CONFIG.algorithm,
      salt,
      iterations: KEY_DERIVATION_CONFIG.iterations,
      hash: KEY_DERIVATION_CONFIG.hash,
    },
    passwordKey,
    {
      name: ENCRYPTION_CONFIG.algorithm,
      length: KEY_DERIVATION_CONFIG.keyLength,
    },
    false, // Non-extractable for security
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * Encrypt data using AES-256-GCM
 *
 * @param data - Any JSON-serializable data to encrypt
 * @param key - The CryptoKey to use for encryption
 * @returns Encrypted data structure with IV and ciphertext
 */
export async function encryptData<T>(
  data: T,
  key: CryptoKey
): Promise<EncryptedData> {
  // Serialize the data to JSON
  const plaintext = JSON.stringify(data);
  const plaintextBytes = new TextEncoder().encode(plaintext);

  // Generate a random IV for this encryption
  const iv = generateIV();

  // Encrypt the data
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: ENCRYPTION_CONFIG.algorithm,
      iv,
      tagLength: ENCRYPTION_CONFIG.tagLength,
    },
    key,
    plaintextBytes
  );

  return {
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
  };
}

/**
 * Decrypt data using AES-256-GCM
 *
 * @param encrypted - The encrypted data structure
 * @param key - The CryptoKey to use for decryption
 * @returns The original decrypted data
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export async function decryptData<T>(
  encrypted: EncryptedData,
  key: CryptoKey
): Promise<T> {
  const iv = new Uint8Array(base64ToArrayBuffer(encrypted.iv));
  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);

  try {
    const plaintextBuffer = await crypto.subtle.decrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv,
        tagLength: ENCRYPTION_CONFIG.tagLength,
      },
      key,
      ciphertext
    );

    const plaintext = new TextDecoder().decode(plaintextBuffer);
    return JSON.parse(plaintext) as T;
  } catch (error) {
    logger.error('Decryption failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to decrypt data - key may be invalid or data may be corrupted');
  }
}

/**
 * Test if encryption is available in this environment
 */
export function isEncryptionSupported(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  );
}
