from typing import Optional, List
from uuid import UUID
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from src.models import AuditLog
from src.schemas import AuditLogResponse

import logging

logger = logging.getLogger("mcp_push_notification.audit")

def log_audit_event(
    db: Session,
    user_id: UUID,
    event_type: str,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
    session_id: Optional[str] = None,
) -> None:
    """
    Log an audit event for a user.
    """
    try:
        audit_entry = AuditLog(
            user_id=user_id,
            event_type=event_type,
            details=details,
            ip_address=ip_address,
            session_id=session_id,
            created_at=datetime.utcnow(),
        )
        db.add(audit_entry)
        db.commit()
        logger.info(f"Audit log created: user_id={user_id}, event_type={event_type}, details={details}")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Failed to log audit event: {e}")

def get_audit_logs_for_user(db: Session, user_id: UUID, limit: int = 100) -> List[AuditLogResponse]:
    """
    Retrieve audit logs for a user, most recent first.
    """
    try:
        logs = (
            db.query(AuditLog)
            .filter(AuditLog.user_id == user_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            AuditLogResponse(
                id=log.id,
                event_type=log.event_type,
                details=log.details,
                created_at=log.created_at,
                ip_address=log.ip_address,
                session_id=log.session_id,
            )
            for log in logs
        ]
    except SQLAlchemyError as e:
        logger.error(f"Failed to retrieve audit logs: {e}")
        return []

# --- EXPORTS ---
__all__ = [
    "log_audit_event",
    "get_audit_logs_for_user",
]