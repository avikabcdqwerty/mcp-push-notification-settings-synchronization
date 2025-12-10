from typing import Dict, Any
from uuid import UUID
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from src.models import User, Device, PushNotificationSettings, AuditLog
import logging

logger = logging.getLogger("mcp_push_notification.notification")

# In-memory deduplication cache (for demonstration; use Redis or DB in production)
_notification_dedup_cache = {}

DEDUPLICATION_WINDOW_SECONDS = 60  # Prevent duplicate notifications within this window

def deduplicate_notification(db: Session, user_id: UUID, notification_payload: Dict[str, Any]) -> bool:
    """
    Deduplicate notifications per user per event.
    Returns True if notification should be sent, False if duplicate.
    """
    try:
        event_id = notification_payload.get("event_id")
        if not event_id:
            logger.warning("Notification payload missing event_id; cannot deduplicate.")
            return True  # If no event_id, cannot deduplicate, so allow

        cache_key = f"{user_id}:{event_id}"
        now = datetime.utcnow()
        last_sent = _notification_dedup_cache.get(cache_key)
        if last_sent and (now - last_sent).total_seconds() < DEDUPLICATION_WINDOW_SECONDS:
            logger.info(f"Duplicate notification prevented for user {user_id}, event {event_id}")
            return False
        _notification_dedup_cache[cache_key] = now
        return True
    except Exception as e:
        logger.error(f"Deduplication error: {e}")
        return True  # Fail open: do not block notification if deduplication fails

def send_push_notification(db: Session, user_id: UUID, notification_payload: Dict[str, Any]) -> None:
    """
    Send a push notification to all enabled devices for the user, respecting per-device settings.
    """
    try:
        # Fetch all devices for the user that have push enabled
        devices = (
            db.query(Device)
            .filter(Device.user_id == user_id, Device.is_push_enabled == True)
            .all()
        )
        if not devices:
            logger.info(f"No enabled devices for user {user_id}; notification not sent.")
            return

        # Fetch user-level and device-level notification settings
        user_settings = (
            db.query(PushNotificationSettings)
            .filter(PushNotificationSettings.user_id == user_id, PushNotificationSettings.device_id == None)
            .one_or_none()
        )
        device_settings_map = {
            s.device_id: s.settings_encrypted
            for s in db.query(PushNotificationSettings)
            .filter(PushNotificationSettings.user_id == user_id, PushNotificationSettings.device_id != None)
            .all()
        }

        # Simulate sending notification (replace with actual push service integration)
        for device in devices:
            # If device is disabled, skip (should not happen due to query, but double-check)
            if not device.is_push_enabled:
                continue
            # Merge user and device settings for this notification
            merged_settings = dict(user_settings.settings_encrypted if user_settings else {})
            device_specific = device_settings_map.get(device.id)
            if device_specific:
                merged_settings.update(device_specific)
            # Here, integrate with actual push notification service (APNs, FCM, etc.)
            logger.info(
                f"Sending notification to device {device.device_id} (user {user_id}): "
                f"payload={notification_payload}, settings={merged_settings}"
            )
            # Placeholder: simulate send
            # push_service.send(device.push_token, notification_payload, merged_settings)
    except SQLAlchemyError as e:
        logger.error(f"Database error during notification send: {e}")
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")

# --- EXPORTS ---
__all__ = [
    "deduplicate_notification",
    "send_push_notification",
]