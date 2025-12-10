from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field, EmailStr, validator

# --- REQUEST SCHEMAS ---

class UserSettingsUpdateRequest(BaseModel):
    """
    Schema for updating centralized user push notification settings.
    """
    settings: Dict[str, Any] = Field(..., description="Push notification preferences (categories, sound, etc.)")
    is_enabled: Optional[bool] = Field(default=True, description="Enable/disable push notifications for user")

    class Config:
        schema_extra = {
            "example": {
                "settings": {
                    "categories": ["alerts", "reminders"],
                    "sound": "default",
                    "do_not_disturb": {"start": "22:00", "end": "07:00"}
                },
                "is_enabled": True
            }
        }

class DeviceSettingsUpdateRequest(BaseModel):
    """
    Schema for updating push notification settings for a specific device.
    """
    is_push_enabled: Optional[bool] = Field(default=True, description="Enable/disable push notifications for device")
    settings: Optional[Dict[str, Any]] = Field(default=None, description="Device-specific notification preferences")

    class Config:
        schema_extra = {
            "example": {
                "is_push_enabled": False,
                "settings": {
                    "sound": "silent"
                }
            }
        }

# --- RESPONSE SCHEMAS ---

class PushNotificationSettingsResponse(BaseModel):
    """
    Response schema for user push notification settings.
    """
    user_id: UUID
    settings: Dict[str, Any]
    is_enabled: bool
    updated_at: datetime
    created_at: datetime

class DeviceResponse(BaseModel):
    """
    Response schema for device details and push notification settings.
    """
    id: int
    device_id: str
    device_type: str
    device_name: Optional[str]
    push_token: Optional[str]
    is_push_enabled: bool
    last_active_at: datetime
    created_at: datetime
    settings: Optional[Dict[str, Any]] = Field(default=None, description="Device-specific notification settings")

class AuditLogResponse(BaseModel):
    """
    Response schema for audit log entries.
    """
    id: int
    event_type: str
    details: Optional[str]
    created_at: datetime
    ip_address: Optional[str]
    session_id: Optional[str]

# --- AUTH SCHEMAS ---

class Token(BaseModel):
    """
    JWT token response schema.
    """
    access_token: str
    token_type: str

class TokenData(BaseModel):
    """
    JWT token payload schema.
    """
    user_id: Optional[UUID] = None
    username: Optional[str] = None
    is_admin: Optional[bool] = False

class UserSession(BaseModel):
    """
    Session info for authenticated user.
    """
    user_id: UUID
    username: str
    email: EmailStr
    is_active: bool
    is_admin: bool

# --- EXPORTS ---
__all__ = [
    "UserSettingsUpdateRequest",
    "DeviceSettingsUpdateRequest",
    "PushNotificationSettingsResponse",
    "DeviceResponse",
    "AuditLogResponse",
    "Token",
    "TokenData",
    "UserSession",
]