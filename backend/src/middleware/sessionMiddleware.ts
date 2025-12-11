import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { auditLogger } from '../utils/auditLogger';

// Redis client for session management (should be configured elsewhere and imported)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = new Redis(redisUrl);

/**
 * Middleware to validate session authorization and handle expired/invalid sessions.
 * Attaches user info to req.user if session is valid.
 */
export async function sessionMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Extract session token from cookie or header
    const sessionToken =
      req.cookies?.sessionToken ||
      req.headers['x-session-token'] ||
      req.headers['authorization']?.toString().replace('Bearer ', '');

    if (!sessionToken || typeof sessionToken !== 'string') {
      auditLogger.error('Session validation failed: No session token provided', {
        ip: req.ip,
        path: req.originalUrl,
      });
      res.status(401).json({ error: 'Unauthorized: No session token provided.' });
      return;
    }

    // Validate session token in Redis
    const sessionData = await redisClient.get(`session:${sessionToken}`);
    if (!sessionData) {
      auditLogger.error('Session validation failed: Session expired or invalid', {
        ip: req.ip,
        path: req.originalUrl,
        sessionToken,
      });
      res.status(401).json({ error: 'Unauthorized: Session expired or invalid.' });
      return;
    }

    // Parse session data and attach to req.user
    let user;
    try {
      user = JSON.parse(sessionData);
    } catch (err) {
      auditLogger.error('Session validation failed: Malformed session data', {
        ip: req.ip,
        path: req.originalUrl,
        sessionToken,
      });
      res.status(401).json({ error: 'Unauthorized: Malformed session data.' });
      return;
    }

    // Optionally, check for session expiration timestamp
    if (user.expiresAt && Date.now() > user.expiresAt) {
      auditLogger.error('Session validation failed: Session expired', {
        ip: req.ip,
        path: req.originalUrl,
        sessionToken,
        userId: user.id,
      });
      res.status(401).json({ error: 'Unauthorized: Session expired.' });
      return;
    }

    // Attach user to request for downstream handlers
    req.user = user;
    next();
  } catch (error) {
    auditLogger.error('Session validation error', {
      error,
      ip: req.ip,
      path: req.originalUrl,
    });
    res.status(500).json({ error: 'Internal server error during session validation.' });
  }
}