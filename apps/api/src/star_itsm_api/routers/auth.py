import asyncio
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.config import settings
from star_itsm_api.core.demo import get_prototype_bootstrap_password
from star_itsm_api.core.password_policy import (
    effective_must_change_password,
    validate_password_for_user,
)
from star_itsm_api.core.prototype_credentials import documented_prototype_password
from star_itsm_api.core.request_client import client_ip_from_request
from star_itsm_api.core.security import (
    create_access_token,
    get_current_user_session,
    get_user_by_email,
    hash_password,
    verify_password,
)
from star_itsm_api.db import engine
from star_itsm_api.db_schema_sync import ensure_auth_login_schema_current
from star_itsm_api.deps import require_db
from star_itsm_api.models.organization import Organization
from star_itsm_api.models.user import User
from star_itsm_api.schemas.auth import (
    AvatarUpdateRequest,
    ChangePasswordRequest,
    LoginRequest,
    TokenResponse,
    UserRead,
    user_to_read,
)
from star_itsm_api.services.login_throttle import (
    assert_login_allowed,
    mark_login_throttle_schema_ready,
    on_login_failure,
    on_login_success,
)
from star_itsm_api.services.org_access import get_user_organization_id
from star_itsm_api.services.prototype_staff_bootstrap import ensure_prototype_staff_account
from star_itsm_api.services.sole_top_admin import enforce_sole_top_admin_on_login
from star_itsm_api.services.user_roles import (
    attach_roles_to_user,
    ensure_user_roles_loaded,
    fetch_user_roles,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_login_auth_schema_ensured = False


async def _ensure_auth_login_schema() -> None:
    """Sync login_throttle + users ORM columns before auth DB queries (Vercel/Neon gap)."""
    global _login_auth_schema_ensured
    if _login_auth_schema_ensured or engine is None or not settings.database_url:
        return
    await ensure_auth_login_schema_current(engine, settings.database_url)
    mark_login_throttle_schema_ready()
    _login_auth_schema_ensured = True


def _current_password_valid(user: User, current_password: str) -> bool:
    if verify_password(current_password, user.password_hash):
        return True
    return secrets.compare_digest(current_password, get_prototype_bootstrap_password())


def _login_password_valid(user: User, password: str) -> bool:
    try:
        if verify_password(password, user.password_hash):
            return True
    except ValueError:
        pass
    documented = documented_prototype_password(user.email)
    if documented is None or not secrets.compare_digest(password, documented):
        return False
    user.password_hash = hash_password(password)
    return True


async def _organization_name(db: AsyncSession, user: User) -> str | None:
    org_id = get_user_organization_id(user)
    if org_id is None:
        return None
    org = await db.get(Organization, org_id)
    return org.name if org else None


@router.post("/login")
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(require_db),
) -> TokenResponse:
    normalized_email = payload.email.lower().strip()
    client_ip = client_ip_from_request(request)
    await _ensure_auth_login_schema()
    await assert_login_allowed(db, normalized_email, client_ip)

    user = await get_user_by_email(db, payload.email)
    password_hash_before = user.password_hash if user is not None else None
    if user is None or not _login_password_valid(user, payload.password):
        await on_login_failure(db, normalized_email, client_ip, user)
        await asyncio.sleep(0.4)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forkert e-mail eller adgangskode",
        )

    await on_login_success(db, normalized_email)

    if user.password_hash != password_hash_before:
        await db.commit()
        await db.refresh(user)

    await ensure_prototype_staff_account(db, user)
    await enforce_sole_top_admin_on_login(db, user)

    roles = [user.role]
    try:
        loaded = await fetch_user_roles(db, user.id)
        if loaded:
            roles = loaded
            attach_roles_to_user(user, loaded)
    except Exception:
        attach_roles_to_user(user, roles)

    token = create_access_token(
        user_id=user.id,
        role=user.role,
        email=user.email,
        must_change_password=effective_must_change_password(user),
    )
    org_name = await _organization_name(db, user)
    return TokenResponse(
        access_token=token,
        user=user_to_read(user, organization_name=org_name, roles=roles),
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(require_db),
) -> None:
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Den nye adgangskode skal være forskellig fra den nuværende",
        )

    user = await get_user_by_email(db, payload.email)
    if user is None or not _current_password_valid(user, payload.current_password):
        await asyncio.sleep(0.4)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forkert e-mail eller nuværende adgangskode",
        )

    try:
        validate_password_for_user(user, payload.new_password)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    await db.commit()


@router.get("/me")
async def me(
    current_user: User = Depends(get_current_user_session),
    db: AsyncSession = Depends(require_db),
) -> UserRead:
    await enforce_sole_top_admin_on_login(db, current_user)
    org_name = await _organization_name(db, current_user)
    roles = await ensure_user_roles_loaded(db, current_user)
    return user_to_read(current_user, organization_name=org_name, roles=roles)


@router.patch("/me/avatar")
async def update_avatar(
    payload: AvatarUpdateRequest,
    current_user: User = Depends(get_current_user_session),
    db: AsyncSession = Depends(require_db),
) -> UserRead:
    if payload.avatar_url is not None and payload.avatar_preset_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Angiv enten upload eller superhelt — ikke begge på én gang",
        )
    if payload.avatar_url is not None:
        if len(payload.avatar_url) > 500_000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Billedet er for stort",
            )
        current_user.avatar_url = payload.avatar_url
        current_user.avatar_preset_id = None
    elif payload.avatar_preset_id is not None:
        current_user.avatar_preset_id = payload.avatar_preset_id
        current_user.avatar_url = None
    else:
        current_user.avatar_url = None
        current_user.avatar_preset_id = None
    await db.commit()
    await db.refresh(current_user)
    org_name = await _organization_name(db, current_user)
    return user_to_read(current_user, organization_name=org_name)
