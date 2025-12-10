from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from src.models import User, SessionLocal
from src.schemas import TokenData, UserSession

import os
import logging

logger = logging.getLogger("mcp_push_notification.auth")

# --- JWT CONFIGURATION ---
SECRET_KEY = os.environ.get("MCP_JWT_SECRET", "supersecretkey")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- UTILS ---

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against its hash.
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """
    Hash a password for storage.
    """
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """
    Decode a JWT access token.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning(f"JWT decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_user_by_id(db: Session, user_id: UUID) -> Optional[User]:
    """
    Retrieve a user by UUID.
    """
    return db.query(User).filter(User.id == user_id, User.is_active == True).one_or_none()

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """
    Retrieve a user by username.
    """
    return db.query(User).filter(User.username == username, User.is_active == True).one_or_none()

# --- AUTH DEPENDENCY ---

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(SessionLocal)
) -> UserSession:
    """
    Dependency to get the current authenticated user from JWT.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("user_id")
        username: str = payload.get("username")
        is_admin: bool = payload.get("is_admin", False)
        if user_id is None or username is None:
            raise credentials_exception
        user = get_user_by_id(db, user_id)
        if user is None:
            raise credentials_exception
        return UserSession(
            user_id=user.id,
            username=user.username,
            email=user.email,
            is_active=user.is_active,
            is_admin=user.is_admin,
        )
    except Exception as e:
        logger.warning(f"Authentication failed: {e}")
        raise credentials_exception

def verify_jwt_token(token: str) -> TokenData:
    """
    Verify and decode a JWT token, returning token data.
    """
    try:
        payload = decode_access_token(token)
        user_id: Optional[str] = payload.get("user_id")
        username: Optional[str] = payload.get("username")
        is_admin: bool = payload.get("is_admin", False)
        return TokenData(
            user_id=user_id,
            username=username,
            is_admin=is_admin,
        )
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

# --- EXPORTS ---
__all__ = [
    "get_current_user",
    "verify_jwt_token",
    "create_access_token",
    "verify_password",
    "get_password_hash",
]