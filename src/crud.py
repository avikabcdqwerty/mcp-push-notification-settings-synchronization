from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, NoResultFound
from sqlalchemy import and_
from fastapi import HTTPException, status

from src.models import (
    User,
    Device,
    PushNotificationSettings,
)
from src.schemas import (
    UserSettingsUpdateRequest,
    DeviceSettingsUpdateRequest,
    PushNotificationSettingsResponse,
    DeviceResponse,
)

import logging

logger = logging.getLogger("mcp_push_notification.crud")

# --- USER SETTINGS CRUD ---

def get_user_settings(db: Session, user_id: UUID) -> PushNotificationSettingsResponse:
    """
    Retrieve centralized push notification settings for a user.
    """
    try:
        settings = (
            db.query(PushNotificationSettings)
            .filter(PushNotificationSettings.user_id == user_id, PushNotificationSettings.device_id == None)
            .one_or_none()
        )
        if not settings:
            # If not found, create default settings
            settings = PushNotificationSettings(
                user_id=user_id,
                device_id=None,
                settings_encrypted={},
                is_enabled=True,
            )
            db.add(settings)
            db.commit()
            db.refresh(settings)
        return PushNotificationSettingsResponse(
            user_id=settings.user_id,
            settings=settings.settings_encrypted,
            is_enabled=settings.is_enabled,
            updated_at=settings.updated_at,
            created_at=settings.created_at,
        )
    except SQLAlchemyError as e:
        logger.error(f"Error retrieving user settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user settings.")

def update_user_settings(db: Session, user_id: UUID, settings_update: UserSettingsUpdateRequest) -> PushNotificationSettingsResponse:
    """
    Update push notification settings for a user and synchronize across all devices.
    """
    try:
        settings = (
            db.query(PushNotificationSettings)
            .filter(PushNotificationSettings.user_id == user_id, PushNotificationSettings.device_id == None)
            .one_or_none()
        )
        if not settings:
            settings = PushNotificationSettings(
                user_id=user_id,
                device_id=None,
                settings_encrypted=settings_update.settings,
                is_enabled=settings_update.is_enabled if settings_update.is_enabled is not None else True,
            )
            db.add(settings)
        else:
            settings.settings_encrypted = settings_update.settings
            if settings_update.is_enabled is not None:
                settings.is_enabled = settings_update.is_enabled
        db.commit()
        db.refresh(settings)
        # Synchronize to all device settings if needed (optional: propagate to device settings)
        return PushNotificationSettingsResponse(
            user_id=settings.user_id,
            settings=settings.settings_encrypted,
            is_enabled=settings.is_enabled,
            updated_at=settings.updated_at,
            created_at=settings.created_at,
        )
    except SQLAlchemyError as e:
        logger.error(f"Error updating user settings: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update user settings.")

# --- DEVICE SETTINGS CRUD ---

def get_device_settings(db: Session, user_id: UUID, device_id: str) -> DeviceResponse:
    """
    Retrieve push notification settings for a specific device.
    """
    try:
        device = (
            db.query(Device)
            .filter(Device.user_id == user_id, Device.device_id == device_id)
            .one_or_none()
        )
        if not device:
            raise HTTPException(status_code=404, detail="Device not found.")
        settings = (
            db.query(PushNotificationSettings)
            .filter(PushNotificationSettings.user_id == user_id, PushNotificationSettings.device_id == device.id)
            .one_or_none()
        )
        return DeviceResponse(
            id=device.id,
            device_id=device.device_id,
            device_type=device.device_type,
            device_name=device.device_name,
            push_token=device.push_token,
            is_push_enabled=device.is_push_enabled,
            last_active_at=device.last_active_at,
            created_at=device.created_at,
            settings=settings.settings_encrypted if settings else None,
        )
    except SQLAlchemyError as e:
        logger.error(f"Error retrieving device settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve device settings.")

def update_device_settings(db: Session, user_id: UUID, device_id: str, settings_update: DeviceSettingsUpdateRequest) -> DeviceResponse:
    """
    Update push notification settings for a specific device.
    """
    try:
        device = (
            db.query(Device)
            .filter(Device.user_id == user_id, Device.device_id == device_id)
            .one_or_none()
        )
        if not device:
            raise HTTPException(status_code=404, detail="Device not found.")
        # Update device-level enable/disable
        if settings_update.is_push_enabled is not None:
            device.is_push_enabled = settings_update.is_push_enabled
        # Update or create device-specific settings
        settings = (
            db.query(PushNotificationSettings)
            .filter(PushNotificationSettings.user_id == user_id, PushNotificationSettings.device_id == device.id)
            .one_or_none()
        )
        if settings_update.settings is not None:
            if not settings:
                settings = PushNotificationSettings(
                    user_id=user_id,
                    device_id=device.id,
                    settings_encrypted=settings_update.settings,
                    is_enabled=device.is_push_enabled,
                )
                db.add(settings)
            else:
                settings.settings_encrypted = settings_update.settings
        db.commit()
        db.refresh(device)
        if settings:
            db.refresh(settings)
        return DeviceResponse(
            id=device.id,
            device_id=device.device_id,
            device_type=device.device_type,
            device_name=device.device_name,
            push_token=device.push_token,
            is_push_enabled=device.is_push_enabled,
            last_active_at=device.last_active_at,
            created_at=device.created_at,
            settings=settings.settings_encrypted if settings else None,
        )
    except SQLAlchemyError as e:
        logger.error(f"Error updating device settings: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update device settings.")

# --- DEVICE LISTING ---

def get_devices_for_user(db: Session, user_id: UUID) -> List[DeviceResponse]:
    """
    List all devices linked to a user.
    """
    try:
        devices = db.query(Device).filter(Device.user_id == user_id).all()
        device_ids = [d.id for d in devices]
        # Fetch all device-specific settings in one query for efficiency
        settings_map = {
            s.device_id: s.settings_encrypted
            for s in db.query(PushNotificationSettings)
            .filter(PushNotificationSettings.user_id == user_id, PushNotificationSettings.device_id.in_(device_ids))
            .all()
        }
        return [
            DeviceResponse(
                id=d.id,
                device_id=d.device_id,
                device_type=d.device_type,
                device_name=d.device_name,
                push_token=d.push_token,
                is_push_enabled=d.is_push_enabled,
                last_active_at=d.last_active_at,
                created_at=d.created_at,
                settings=settings_map.get(d.id),
            )
            for d in devices
        ]
    except SQLAlchemyError as e:
        logger.error(f"Error listing user devices: {e}")
        raise HTTPException(status_code=500, detail="Failed to list user devices.")

# --- EXPORTS ---
__all__ = [
    "get_user_settings",
    "update_user_settings",
    "get_device_settings",
    "update_device_settings",
    "get_devices_for_user",
]