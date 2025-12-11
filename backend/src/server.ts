import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { createConnection } from 'typeorm';
import redis from 'redis';
import path from 'path';
import fs from 'fs';

// Import custom middleware and routes
import { authMiddleware } from './middleware/auth.middleware';
import notificationSettingsRouter from './controllers/notificationSettings.controller';
import { auditLogger } from './utils/auditLogger';

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Application = express();

// Middleware: Security headers
app.use(helmet());

// Middleware: Enable CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

// Middleware: Request logging
app.use(morgan('combined'));

// Middleware: JSON body parsing
app.use(express.json());

// Middleware: Compression
app.use(compression());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Swagger API docs
const swaggerPath = path.join(__dirname, '../docs/swagger.yaml');
if (fs.existsSync(swaggerPath)) {
  const swaggerDocument = require('yamljs').load(swaggerPath);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Audit logging middleware (logs all settings changes)
app.use(auditLogger);

// Protected routes: Notification Settings
app.use('/api/notification-settings', authMiddleware, notificationSettingsRouter);

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Log error details
  console.error(`[ERROR] ${err.message}`, {
    stack: err.stack,
    path: req.path,
    user: req.user ? req.user.id : 'anonymous',
  });

  // Handle unauthorized errors
  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session.' });
  }

  // Handle validation errors
  if (err.status === 400) {
    return res.status(400).json({ error: err.message });
  }

  // Default to 500
  res.status(500).json({ error: 'Internal Server Error' });
});

// Database connection (PostgreSQL via TypeORM)
createConnection()
  .then(() => {
    console.log('[INFO] Connected to PostgreSQL database.');
  })
  .catch((error) => {
    console.error('[ERROR] Database connection failed:', error);
    process.exit(1);
  });

// Redis client setup (for deduplication and session cache)
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});
redisClient.on('error', (err) => {
  console.error('[ERROR] Redis connection error:', err);
});
redisClient.on('connect', () => {
  console.log('[INFO] Connected to Redis.');
});

// Export redisClient for use in other modules
export { redisClient };

// Start server
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
app.listen(PORT, () => {
  console.log(`[INFO] MCP Push Notification Settings Sync server running on port ${PORT}`);
});

export default app;