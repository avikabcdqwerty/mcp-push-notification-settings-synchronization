import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

/**
 * JWT-based authentication and session validation middleware.
 * Attaches user info to req.user if valid.
 * Blocks unauthorized or expired sessions.
 */

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-in-production';

/**
 * Express middleware to authenticate requests using JWT.
 * Adds user info to req.user on success.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header missing or malformed.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'JWT token missing.' });
    }

    // Verify JWT
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err || !decoded) {
        return res.status(401).json({ error: 'Invalid or expired session.' });
      }

      // Attach user info to request
      // @ts-ignore
      req.user = typeof decoded === 'object' ? decoded : {};

      next();
    });
  } catch (err) {
    console.error('[authMiddleware] Authentication error:', err);
    res.status(500).json({ error: 'Authentication failed.' });
  }
}

export default authMiddleware;