import asyncio
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError
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
    ROLE_ADMIN,
    ROLE_TOP_ADMIN,
    create_access_token,
    decode_access_token,
    get_current_user_session,
    get_user_by_email,
    get_user_by_email_any_state,
    hash_password,
    impersonator_id_from_token_payload,
    security_scheme,
    verify_password,
)
from star_itsm_api.db import engine
from star_itsm_api.db_schema_sync import (
    ensure_login_throttle_schema_current,
    ensure_prototype_staff_accounts_current,
)
from star_itsm_api.deps import require_db
from star_itsm_api.models.organization import Organization
from star_itsm_api.models.user import User
from star_itsm_api.schemas.auth import (
    AvatarUpdateRequest,
    ChangePasswordRequest,
    ImpersonateRequest,
    ImpersonatorRead,
    LoginRequest,
    TokenResponse,
    UserRead,
    user_to_read,
)
from star_itsm_api.schemas.theme_palette import ThemePaletteUpdateRequest
from star_itsm_api.services.login_throttle import (
    assert_login_allowed,
    mark_login_throttle_schema_ready,
    on_login_failure,
    on_login_success,
)
from star_itsm_api.services.org_access import get_user_organization_id
from star_itsm_api.services.prototype_staff_bootstrap import ensure_prototype_staff_account
from star_itsm_api.services.sole_top_admin import enforce_sole_top_admin_on_login
from star_itsm_api.services.theme_palette import (
    merge_theme_palette_update,
    normalize_theme_palette_preference,
    theme_palette_to_storage,
    validate_theme_palette,
)
from star_itsm_api.services.user_roles import (
    attach_roles_to_user,
    ensure_user_roles_loaded,
    fetch_user_roles,
    user_has_any_role,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_login_throttle_schema_ensured = False


async def _ensure_login_throttle_schema() -> None:
    """Create login_throttle on first login when Vercel cold-start sync did not run."""
    global _login_throttle_schema_ensured
    if _login_throttle_schema_ensured or engine is None or not settings.database_url:
        return
    await ensure_login_throttle_schema_current(engine, settings.database_url)
    mark_login_throttle_schema_ready()
    _login_throttle_schema_ensured = True


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


async def _impersonator_from_token(
    credentials: HTTPAuthorizationCredentials | None,
    db: AsyncSession,
) -> ImpersonatorRead | None:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    payload = decode_access_token(credentials.credentials)
    impersonator_id = impersonator_id_from_token_payload(payload)
    if impersonator_id is None:
        return None
    admin = await db.get(User, impersonator_id)
    if admin is None or not admin.is_active or admin.deleted_at is not None:
        return None
    return ImpersonatorRead(
        id=admin.id,
        email=admin.email,
        display_name=admin.display_name,
    )


async def _resolve_impersonate_admin(
    credentials: HTTPAuthorizationCredentials | None,
    db: AsyncSession,
    session_user: User,
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    payload = decode_access_token(credentials.credentials)
    impersonator_id = impersonator_id_from_token_payload(payload)
    if impersonator_id is not None:
        admin = await db.get(User, impersonator_id)
        if admin is None or not admin.is_active or admin.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Impersonation session invalid",
            )
        await ensure_user_roles_loaded(db, admin)
        if not user_has_any_role(admin, ROLE_ADMIN, ROLE_TOP_ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return admin
    if not user_has_any_role(session_user, ROLE_ADMIN, ROLE_TOP_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return session_user


async def _token_response_for_user(
    db: AsyncSession,
    user: User,
    *,
    impersonator_id: UUID | None = None,
) -> TokenResponse:
    roles = await ensure_user_roles_loaded(db, user)
    token = create_access_token(
        user_id=user.id,
        role=user.role,
        email=user.email,
        must_change_password=False if impersonator_id else effective_must_change_password(user),
        impersonator_id=impersonator_id,
    )
    org_name = await _organization_name(db, user)
    impersonator = None
    if impersonator_id is not None:
        admin = await db.get(User, impersonator_id)
        if admin is not None:
            impersonator = ImpersonatorRead(
                id=admin.id,
                email=admin.email,
                display_name=admin.display_name,
            )
    return TokenResponse(
        access_token=token,
        user=user_to_read(
            user,
            organization_name=org_name,
            roles=roles,
            impersonator=impersonator,
        ),
    )


async def _resolve_login_user(db: AsyncSession, email: str) -> User | None:
    """Active user lookup; prototype @example.dk may recover soft-deleted rows."""
    user = await get_user_by_email(db, email)
    if user is not None:
        return user
    if documented_prototype_password(email) is None:
        return None
    await ensure_prototype_staff_accounts_current(engine, settings.database_url)
    user = await get_user_by_email(db, email)
    if user is not None:
        return user
    return await get_user_by_email_any_state(db, email)


@router.post("/login")
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(require_db),
) -> TokenResponse:
    normalized_email = payload.email.lower().strip()
    client_ip = client_ip_from_request(request)
    await _ensure_login_throttle_schema()
    await assert_login_allowed(db, normalized_email, client_ip)

    user = await _resolve_login_user(db, payload.email)
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
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: AsyncSession = Depends(require_db),
) -> UserRead:
    await enforce_sole_top_admin_on_login(db, current_user)
    org_name = await _organization_name(db, current_user)
    roles = await ensure_user_roles_loaded(db, current_user)
    impersonator = await _impersonator_from_token(credentials, db)
    return user_to_read(
        current_user,
        organization_name=org_name,
        roles=roles,
        impersonator=impersonator,
    )


@router.post("/impersonate")
async def impersonate(
    payload: ImpersonateRequest,
    current_user: User = Depends(get_current_user_session),
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: AsyncSession = Depends(require_db),
) -> TokenResponse:
    admin = await _resolve_impersonate_admin(credentials, db, current_user)
    target = await db.get(User, payload.user_id)
    if target is None or not target.is_active or target.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Du kan ikke impersonere dig selv",
        )
    return await _token_response_for_user(db, target, impersonator_id=admin.id)


@router.post("/stop-impersonate")
async def stop_impersonate(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: AsyncSession = Depends(require_db),
) -> TokenResponse:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    token_payload = decode_access_token(credentials.credentials)
    impersonator_id = impersonator_id_from_token_payload(token_payload)
    if impersonator_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Du impersonerer ikke en bruger",
        )
    admin = await db.get(User, impersonator_id)
    if admin is None or not admin.is_active or admin.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Impersonation session invalid",
        )
    await ensure_user_roles_loaded(db, admin)
    if not user_has_any_role(admin, ROLE_ADMIN, ROLE_TOP_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return await _token_response_for_user(db, admin)


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


@router.patch("/me/theme-palette")
async def update_theme_palette(
    payload: ThemePaletteUpdateRequest,
    current_user: User = Depends(get_current_user_session),
    db: AsyncSession = Depends(require_db),
) -> UserRead:
    current = normalize_theme_palette_preference(getattr(current_user, "theme_palette", None))
    try:
        merged = merge_theme_palette_update(current, payload)
        validate_theme_palette(merged)
    except ValidationError as exc:
        detail = exc.errors()[0]["msg"] if exc.errors() else "Ugyldigt farvetema"
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail.removeprefix("Value error, "),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    current_user.theme_palette = theme_palette_to_storage(merged)
    await db.commit()
    await db.refresh(current_user)
    org_name = await _organization_name(db, current_user)
    roles = await ensure_user_roles_loaded(db, current_user)
    return user_to_read(current_user, organization_name=org_name, roles=roles)
