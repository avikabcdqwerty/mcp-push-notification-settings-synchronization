import fs from 'fs';
import path from 'path';

/**
 * AuditLogger
 * Logs all notification settings changes for audit and security compliance.
 * Logs are written to a file and can be extended to log to external systems.
 */

const AUDIT_LOG_PATH = process.env.AUDIT_LOG_PATH || path.join(__dirname, '../../logs/audit.log');

// Ensure log directory exists
const logDir = path.dirname(AUDIT_LOG_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

export interface AuditLogEntry {
  userId: string;
  deviceId?: string;
  action: string;
  details: Record<string, any>;
  timestamp: Date;
}

/**
 * Writes an audit log entry to the audit log file.
 * @param entry - The audit log entry to record.
 */
async function log(entry: AuditLogEntry): Promise<void> {
  try {
    const logLine = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    }) + '\n';

    await fs.promises.appendFile(AUDIT_LOG_PATH, logLine, { encoding: 'utf8' });
  } catch (err) {
    // Non-fatal: log to console if file write fails
    console.error('[auditLogger] Failed to write audit log:', err, entry);
  }
}

/**
 * Express middleware for logging settings changes.
 * Should be used before protected routes.
 */
function auditLogger(req: any, res: any, next: any): void {
  // For extensibility: could log all requests, or only those that mutate settings
  // Here, we only log in the service/controller for relevant actions
  next();
}

export const auditLoggerInstance = { log };
export { log, auditLogger };