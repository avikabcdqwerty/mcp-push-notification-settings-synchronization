import logging
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.schemas import (
    UserSettingsUpdateRequest,
    DeviceSettingsUpdateRequest,
    PushNotificationSettingsResponse,
    AuditLogResponse,
    DeviceResponse,
)
from src.crud import (
    get_user_settings,
    update_user_settings,
    get_device_settings,
    update_device_settings,
    get_devices_for_user,
)
from src.auth import (
    get_current_user,
    UserSession,
    verify_jwt_token,
)
from src.audit import (
    log_audit_event,
    get_audit_logs_for_user,
)
from src.notification import (
    send_push_notification,
    deduplicate_notification,
)
from src.models import (
    SessionLocal,
    Base,
    engine,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
logger = logging.getLogger("mcp_push_notification")

# Create database tables if not exist (for dev/demo; use Alembic in prod)
Base.metadata.create_all(bind=engine)

# FastAPI app initialization
app = FastAPI(
    title="MCP Push Notification Settings Synchronization API",
    description="Centralized API for managing and synchronizing push notification settings across multiple devices.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS middleware (adjust origins as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Exception handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.warning(f"HTTPException: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"Database error: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Database error."},
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error."},
    )

# Health check endpoint
@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok"}

# --- AUTH ROUTES ---
@app.post("/auth/login", tags=["Auth"])
def login():
    """
    Placeholder for login endpoint.
    Actual implementation in src/auth.py.
    """
    raise HTTPException(status_code=501, detail="Login not implemented here.")

# --- PUSH NOTIFICATION SETTINGS ROUTES ---

@app.get("/settings/user", response_model=PushNotificationSettingsResponse, tags=["Settings"])
def get_user_push_settings(
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Retrieve centralized push notification settings for the authenticated user.
    """
    settings = get_user_settings(db, user_id=current_user.user_id)
    return settings

@app.put("/settings/user", response_model=PushNotificationSettingsResponse, tags=["Settings"])
def update_user_push_settings(
    payload: UserSettingsUpdateRequest,
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Update push notification settings for the authenticated user.
    Changes are synchronized across all devices.
    """
    # Authorization and session validation handled in get_current_user
    updated_settings = update_user_settings(db, user_id=current_user.user_id, settings_update=payload)
    log_audit_event(
        db=db,
        user_id=current_user.user_id,
        event_type="USER_SETTINGS_UPDATE",
        details=f"Updated user settings: {payload.dict()}"
    )
    return updated_settings

@app.get("/settings/device/{device_id}", response_model=DeviceResponse, tags=["Settings"])
def get_device_push_settings(
    device_id: str,
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Retrieve push notification settings for a specific device.
    """
    device_settings = get_device_settings(db, user_id=current_user.user_id, device_id=device_id)
    return device_settings

@app.put("/settings/device/{device_id}", response_model=DeviceResponse, tags=["Settings"])
def update_device_push_settings(
    device_id: str,
    payload: DeviceSettingsUpdateRequest,
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Enable/disable push notifications for a specific device.
    """
    updated_device = update_device_settings(db, user_id=current_user.user_id, device_id=device_id, settings_update=payload)
    log_audit_event(
        db=db,
        user_id=current_user.user_id,
        event_type="DEVICE_SETTINGS_UPDATE",
        details=f"Updated device {device_id} settings: {payload.dict()}"
    )
    return updated_device

@app.get("/devices", response_model=list[DeviceResponse], tags=["Devices"])
def list_user_devices(
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    List all devices linked to the authenticated user.
    """
    devices = get_devices_for_user(db, user_id=current_user.user_id)
    return devices

# --- AUDIT LOG ROUTES ---
@app.get("/audit/logs", response_model=list[AuditLogResponse], tags=["Audit"])
def get_audit_logs(
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Retrieve audit logs for the authenticated user.
    """
    logs = get_audit_logs_for_user(db, user_id=current_user.user_id)
    return logs

# --- PUSH NOTIFICATION DISPATCH (ADMIN/INTERNAL) ---
@app.post("/notifications/send", tags=["Notifications"])
def send_notification(
    notification_payload: dict,
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Dispatch a push notification to all devices for the user, preventing duplicates.
    Only one notification per user per event.
    """
    # Only allow authorized internal/admin users (extend as needed)
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to send notifications.")
    deduped = deduplicate_notification(db, user_id=current_user.user_id, notification_payload=notification_payload)
    if deduped:
        send_push_notification(db, user_id=current_user.user_id, notification_payload=notification_payload)
        log_audit_event(
            db=db,
            user_id=current_user.user_id,
            event_type="NOTIFICATION_SENT",
            details=f"Notification sent: {notification_payload}"
        )
        return {"status": "sent"}
    else:
        return {"status": "duplicate_prevented"}

# --- EXPORTS ---
# The FastAPI app instance is exported for ASGI servers (e.g., uvicorn)
# Usage: uvicorn src.main:app --host 0.0.0.0 --port 8000