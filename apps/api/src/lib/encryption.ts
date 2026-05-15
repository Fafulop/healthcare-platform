/**
 * AES-256-GCM encryption for sensitive credentials (e.Firma keys, etc.)
 * Uses Node.js built-in crypto — zero dependencies.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.FIEL_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('FIEL_ENCRYPTION_KEY environment variable is not set');
  }
  // Key must be 32 bytes for AES-256. Accept hex (64 chars) or base64 (44 chars).
  if (key.length === 64) return Buffer.from(key, 'hex');
  if (key.length === 44) return Buffer.from(key, 'base64');
  throw new Error('FIEL_ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)');
}

/**
 * Encrypt a string. Returns base64 string: iv + tag + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Pack: iv (12) + tag (16) + ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a base64 string produced by encrypt().
 */
export function decrypt(packed: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(packed, 'base64');

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext) + decipher.final('utf8');
}
