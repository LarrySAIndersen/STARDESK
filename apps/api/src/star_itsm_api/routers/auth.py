import asyncio
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.demo import PROTOTYPE_BOOTSTRAP_PASSWORD
from star_itsm_api.core.password_policy import validate_password
from star_itsm_api.core.security import (
    create_access_token,
    get_current_user_session,
    get_user_by_email,
    hash_password,
    verify_password,
)
from star_itsm_api.deps import require_db
from star_itsm_api.models.organization import Organization
from star_itsm_api.models.user import User
from star_itsm_api.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    TokenResponse,
    UserRead,
    user_to_read,
)
from star_itsm_api.services.org_access import get_user_organization_id

router = APIRouter(prefix="/auth", tags=["auth"])


def _current_password_valid(user: User, current_password: str) -> bool:
    if verify_password(current_password, user.password_hash):
        return True
    return secrets.compare_digest(current_password, PROTOTYPE_BOOTSTRAP_PASSWORD)


async def _organization_name(db: AsyncSession, user: User) -> str | None:
    org_id = get_user_organization_id(user)
    if org_id is None:
        return None
    org = await db.get(Organization, org_id)
    return org.name if org else None


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(require_db),
) -> TokenResponse:
    user = await get_user_by_email(db, payload.email)
    if user is None or not verify_password(payload.password, user.password_hash):
        await asyncio.sleep(0.4)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forkert e-mail eller adgangskode",
        )

    token = create_access_token(user_id=user.id, role=user.role, email=user.email)
    org_name = await _organization_name(db, user)
    return TokenResponse(access_token=token, user=user_to_read(user, organization_name=org_name))


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

    try:
        validate_password(payload.new_password)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    user = await get_user_by_email(db, payload.email)
    if user is None or not _current_password_valid(user, payload.current_password):
        await asyncio.sleep(0.4)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forkert e-mail eller nuværende adgangskode",
        )

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    await db.commit()


@router.get("/me", response_model=UserRead)
async def me(
    current_user: User = Depends(get_current_user_session),
    db: AsyncSession = Depends(require_db),
) -> UserRead:
    org_name = await _organization_name(db, current_user)
    return user_to_read(current_user, organization_name=org_name)
