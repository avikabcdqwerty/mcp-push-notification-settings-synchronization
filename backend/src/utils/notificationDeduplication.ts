import { redisClient } from '../server';

/**
 * Utility for deduplicating push notifications using Redis.
 * Ensures only one notification is sent per event per user, regardless of device count.
 */

const DEDUPLICATION_TTL_SECONDS = 60; // Time window to prevent duplicate notifications

/**
 * Checks if a notification event for a user has already been processed.
 * If not, marks it as processed for deduplication.
 * @param userId - The user ID.
 * @param eventId - Unique notification event ID (e.g., UUID or hash).
 * @returns Promise<boolean> - true if this is the first time (should send), false if duplicate.
 */
export async function shouldSendNotification(userId: string, eventId: string): Promise<boolean> {
  const key = `notif-dedup:${userId}:${eventId}`;
  return new Promise<boolean>((resolve, reject) => {
    redisClient.setnx(key, '1', (err, result) => {
      if (err) {
        console.error('[notificationDeduplication] Redis error:', err);
        return reject(err);
      }
      if (result === 1) {
        // First time, set expiry
        redisClient.expire(key, DEDUPLICATION_TTL_SECONDS, (expireErr) => {
          if (expireErr) {
            console.warn('[notificationDeduplication] Failed to set expiry on dedup key:', key);
          }
          resolve(true);
        });
      } else {
        // Duplicate event
        resolve(false);
      }
    });
  });
}

/**
 * Clears deduplication key for a user/event (for testing or manual reset).
 * @param userId - The user ID.
 * @param eventId - Unique notification event ID.
 */
export async function clearDeduplication(userId: string, eventId: string): Promise<void> {
  const key = `notif-dedup:${userId}:${eventId}`;
  return new Promise<void>((resolve, reject) => {
    redisClient.del(key, (err) => {
      if (err) {
        console.error('[notificationDeduplication] Redis error:', err);
        return reject(err);
      }
      resolve();
    });
  });
}