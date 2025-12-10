from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    UniqueConstraint,
    create_engine,
    LargeBinary,
)
from sqlalchemy.orm import relationship, declarative_base, sessionmaker
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy_utils import UUIDType, EncryptedType
from cryptography.fernet import Fernet
import os

# --- Encryption Key Management ---
# In production, use a secure key vault or environment variable
ENCRYPTION_KEY = os.environ.get("MCP_ENCRYPTION_KEY", Fernet.generate_key())

# --- SQLAlchemy Base and Engine ---
Base = declarative_base()

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg2://mcp_user:mcp_password@localhost:5432/mcp_db"
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- MODELS ---

class User(Base):
    """
    Represents an MCP end user.
    """
    __tablename__ = "users"

    id = Column(UUIDType(binary=False), primary_key=True, unique=True, nullable=False)
    username = Column(String(128), unique=True, nullable=False, index=True)
    email = Column(String(256), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    devices = relationship("Device", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("PushNotificationSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")

class Device(Base):
    """
    Represents a device linked to a user account.
    """
    __tablename__ = "devices"
    __table_args__ = (
        UniqueConstraint("user_id", "device_id", name="uq_user_device"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(128), nullable=False)  # Device UUID or token
    user_id = Column(UUIDType(binary=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_type = Column(String(64), nullable=False)  # e.g., 'ios', 'android', 'web'
    device_name = Column(String(128), nullable=True)
    push_token = Column(String(256), nullable=True)  # For push notification delivery
    is_push_enabled = Column(Boolean, default=True, nullable=False)
    last_active_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="devices")
    settings = relationship("PushNotificationSettings", back_populates="device", uselist=False, cascade="all, delete-orphan")

class PushNotificationSettings(Base):
    """
    Stores push notification preferences for a user and/or device.
    Sensitive settings are encrypted at rest.
    """
    __tablename__ = "push_notification_settings"
    __table_args__ = (
        UniqueConstraint("user_id", "device_id", name="uq_settings_user_device"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUIDType(binary=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=True)
    # Encrypted JSON field for settings (e.g., categories, sound, etc.)
    settings_encrypted = Column(
        EncryptedType(JSON, ENCRYPTION_KEY, Fernet, AesMode="CBC"),
        nullable=False,
        default=dict,
    )
    is_enabled = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="settings")
    device = relationship("Device", back_populates="settings")

class AuditLog(Base):
    """
    Audit log for settings changes and security events.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUIDType(binary=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(64), nullable=False)
    details = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ip_address = Column(String(64), nullable=True)
    session_id = Column(String(128), nullable=True)

    user = relationship("User", back_populates="audit_logs")

# --- EXPORTS ---
__all__ = [
    "Base",
    "engine",
    "SessionLocal",
    "User",
    "Device",
    "PushNotificationSettings",
    "AuditLog",
    "ENCRYPTION_KEY",
]