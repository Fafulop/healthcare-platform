/**
 * Mercado Pago helpers for marketplace integration.
 * - AES-256-GCM encryption for access/refresh tokens
 * - Thin fetch wrapper for MP API calls
 * - Webhook signature verification (HMAC-SHA256)
 */

import crypto from 'crypto';

// ── Encryption (AES-256-GCM) ──

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit IV
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

function getEncryptionKey(): Buffer {
  const key = process.env.MP_ENCRYPTION_KEY;
  if (!key) throw new Error('MP_ENCRYPTION_KEY is not configured');
  return Buffer.from(key, 'hex'); // 32 bytes = 256 bits
}

/** Encrypt plaintext → hex string (iv + authTag + ciphertext) */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Prepend IV + authTag so we can extract them on decrypt
  return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

/** Decrypt hex string → plaintext */
export function decrypt(encryptedHex: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encryptedHex, 'hex');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

// ── MP API Fetch ──

const MP_API_BASE = 'https://api.mercadopago.com';

/** Thin wrapper around fetch for MP API calls */
export async function mpFetch(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    accessToken?: string;
  } = {}
): Promise<Response> {
  const { method = 'GET', body, accessToken } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return fetch(`${MP_API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Webhook Signature Verification ──

/**
 * Verify Mercado Pago webhook signature (HMAC-SHA256).
 * See: https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
 */
export function verifyWebhookSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  secret: string
): boolean {
  // Parse "ts=...,v1=..." from x-signature header
  const parts = xSignature.split(',');
  const ts = parts.find(p => p.trimStart().startsWith('ts='))?.split('=')[1];
  const v1 = parts.find(p => p.trimStart().startsWith('v1='))?.split('=')[1];

  if (!ts || !v1) return false;

  // Build manifest: id:[data.id];request-id:[x-request-id];ts:[ts];
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  // Generate HMAC-SHA256
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  return hmac === v1;
}
