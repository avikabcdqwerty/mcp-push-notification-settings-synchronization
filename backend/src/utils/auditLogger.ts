import { createLogger, format, transports, Logger } from 'winston';
import { Repository, getRepository, Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * TypeORM entity for audit logs.
 */
@Entity({ name: 'audit_logs' })
class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  action!: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  deviceId?: string;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  category?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp!: Date;
}

/**
 * Winston logger instance for audit and error logs.
 */
const winstonLogger: Logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console(),
    // Add file transport or external log service as needed
  ],
});

/**
 * AuditLogger utility for logging settings changes and fetching audit logs.
 */
export const auditLogger = {
  /**
   * Log an info-level audit event and persist to DB.
   * @param {string} action - Action performed (e.g., 'update', 'sync').
   * @param {object} meta - Metadata (userId, deviceId, details, category).
   */
  async info(action: string, meta: Record<string, any> = {}): Promise<void> {
    try {
      winstonLogger.info(action, meta);

      const repo: Repository<AuditLog> = getRepository(AuditLog);
      const log = repo.create({
        action,
        userId: meta.userId,
        deviceId: meta.deviceId,
        details: meta.details ? JSON.stringify(meta.details) : undefined,
        category: meta.category || 'notification-settings',
      });
      await repo.save(log);
    } catch (error) {
      winstonLogger.error('Failed to persist audit log', { error, action, meta });
    }
  },

  /**
   * Log an error-level audit event and persist to DB.
   * @param {string} action - Action performed.
   * @param {object} meta - Metadata (userId, deviceId, details, category).
   */
  async error(action: string, meta: Record<string, any> = {}): Promise<void> {
    try {
      winstonLogger.error(action, meta);

      const repo: Repository<AuditLog> = getRepository(AuditLog);
      const log = repo.create({
        action: `ERROR: ${action}`,
        userId: meta.userId,
        deviceId: meta.deviceId,
        details: meta.details ? JSON.stringify(meta.details) : undefined,
        category: meta.category || 'notification-settings',
      });
      await repo.save(log);
    } catch (err) {
      winstonLogger.error('Failed to persist error audit log', { err, action, meta });
    }
  },

  /**
   * Fetch audit logs for a given category (e.g., 'notification-settings').
   * @param {string} category
   * @param {number} [limit=100]
   * @returns {Promise<AuditLog[]>}
   */
  async fetchLogs(category: string, limit: number = 100): Promise<AuditLog[]> {
    try {
      const repo: Repository<AuditLog> = getRepository(AuditLog);
      return await repo.find({
        where: { category },
        order: { timestamp: 'DESC' },
        take: limit,
      });
    } catch (error) {
      winstonLogger.error('Failed to fetch audit logs', { error, category });
      return [];
    }
  },
};

export { AuditLog };