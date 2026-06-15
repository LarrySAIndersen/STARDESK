from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.config import settings
from star_itsm_api.core.http_details import INSUFFICIENT_PERMISSIONS, USER_NOT_FOUND
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.services.user_roles import (
    ensure_user_roles_loaded,
    user_has_any_role,
    user_role_set,
)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 12

security_scheme = HTTPBearer(auto_error=False)

ROLE_SUBMITTER = "end_user"
ROLE_AGENT = "agent"
ROLE_ADMIN = "admin"
ROLE_TOP_ADMIN = "top_admin"
ROLE_SUPPORTER = "supporter"
ROLE_STARDESK_REVIEWER = "stardesk_reviewer"
ROLE_KUNDEPORTAL_2 = "kundeportal_2"

USER_ROLE_PATTERN = r"^(end_user|agent|admin|top_admin|supporter|stardesk_reviewer|kundeportal_2)$"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def _prototype_bcrypt_salt(pepper: str) -> bytes:
    """Fixed bcrypt salt prefix per prototype pepper (29 chars — not a password hash)."""
    salts: dict[str, str] = {
        "larry-demo-v1": "$2b$12$R4g4tKPsO73abz4FuHtEXuYIwua1R",
        "example-dk-v1": "$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC"[:29],
        "default": "$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC"[:29],
    }
    salt = salts.get(pepper) or salts["default"]
    return salt.encode("utf-8")


def hash_prototype_password(password: str, *, pepper: str = "default") -> str:
    """Deterministic bcrypt for documented demo/seed accounts (prototype only)."""
    salt = _prototype_bcrypt_salt(pepper)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(
    *,
    user_id: UUID,
    role: str,
    email: str,
    must_change_password: bool = False,
    impersonator_id: UUID | None = None,
) -> str:
    if not settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT_SECRET is not configured",
        )
    expire = datetime.now(UTC) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "email": email,
        "must_change_password": must_change_password,
        "exp": expire,
    }
    if impersonator_id is not None:
        payload["impersonator_id"] = str(impersonator_id)
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def impersonator_id_from_token_payload(payload: dict[str, Any]) -> UUID | None:
    raw = payload.get("impersonator_id")
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except ValueError:
        return None


def decode_access_token(token: str) -> dict[str, Any]:
    if not settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT_SECRET is not configured",
        )
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


def ensure_password_changed(user: User) -> None:
    if user.password_policy_exempt:
        return
    if user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="must_change_password",
        )


async def get_current_user_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: AsyncSession = Depends(require_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await db.get(User, UUID(str(user_id)))
    if user is None or not user.is_active or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=USER_NOT_FOUND)
    await ensure_user_roles_loaded(db, user)
    return user


def get_current_user(
    request: Request,
    user: User = Depends(get_current_user_session),
) -> User:
    # Option A (prototype): allow read-only GET/HEAD while must_change_password so list
    # pages work after migration 17; block POST/PUT/PATCH/DELETE until password changed.
    if request.method not in ("GET", "HEAD"):
        ensure_password_changed(user)
    return user


def require_roles(*roles: str):
    allowed = frozenset(roles)

    def _checker(user: User = Depends(get_current_user)) -> User:
        if not (user_role_set(user) & allowed):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=INSUFFICIENT_PERMISSIONS,
            )
        return user

    return _checker


def is_staff(user: User) -> bool:
    return user_has_any_role(
        user,
        ROLE_AGENT,
        ROLE_ADMIN,
        ROLE_TOP_ADMIN,
        ROLE_SUPPORTER,
    )


def require_staff():
    return require_roles(
        ROLE_AGENT,
        ROLE_ADMIN,
        ROLE_TOP_ADMIN,
        ROLE_SUPPORTER,
    )


def require_admin():
    """Config/user admin — supporter is staff but not a config admin (FINDING-114)."""
    return require_roles(ROLE_ADMIN, ROLE_TOP_ADMIN)


def require_admin_session():
    """Admin guard using session user only — skips must_change_password mutation gate.

    Use for user-management endpoints so admins can manage other accounts before
    completing their own first-time password change.
    """

    def _checker(user: User = Depends(get_current_user_session)) -> User:
        if not user_has_any_role(user, ROLE_ADMIN, ROLE_TOP_ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=INSUFFICIENT_PERMISSIONS,
            )
        return user

    return _checker


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(
        select(User).where(
            User.email == email.lower().strip(),
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none()


async def get_user_by_email_any_state(db: AsyncSession, email: str) -> User | None:
    """Lookup by email including soft-deleted or inactive rows (prototype recovery)."""
    result = await db.execute(
        select(User).where(User.email == email.lower().strip())
    )
    return result.scalar_one_or_none()
