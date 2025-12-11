import crypto from 'crypto';

/**
 * Utility functions for encrypting and decrypting settings data.
 * Uses AES-256-GCM for strong symmetric encryption.
 */

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef'; // 32 bytes
const IV_LENGTH = 12; // AES-GCM recommended IV length

/**
 * Encrypts a JavaScript object as a string using AES-256-GCM.
 * @param data - The object to encrypt.
 * @returns Encrypted string (base64).
 */
export function encryptData(data: Record<string, any>): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);

    const json = JSON.stringify(data);
    let encrypted = cipher.update(json, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    // Store iv, authTag, and encrypted data together (base64-encoded)
    const result = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')]).toString('base64');
    return result;
  } catch (err) {
    console.error('[encryption.util] encryptData error:', err);
    throw new Error('Failed to encrypt data.');
  }
}

/**
 * Decrypts a string (base64) to a JavaScript object using AES-256-GCM.
 * @param encrypted - The encrypted string.
 * @returns Decrypted object.
 */
export function decryptData(encrypted: string): Record<string, any> {
  try {
    const bData = Buffer.from(encrypted, 'base64');
    const iv = bData.slice(0, IV_LENGTH);
    const authTag = bData.slice(IV_LENGTH, IV_LENGTH + 16);
    const encryptedText = bData.slice(IV_LENGTH + 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (err) {
    console.error('[encryption.util] decryptData error:', err);
    throw new Error('Failed to decrypt data.');
  }
}