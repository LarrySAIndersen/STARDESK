from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import (
    create_access_token,
    get_current_user,
    get_user_by_email,
    verify_password,
)
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.auth import LoginRequest, TokenResponse, UserRead, user_to_read

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(require_db),
) -> TokenResponse:
    user = await get_user_by_email(db, payload.email)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forkert e-mail eller adgangskode",
        )

    token = create_access_token(user_id=user.id, role=user.role, email=user.email)
    return TokenResponse(access_token=token, user=user_to_read(user))


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return user_to_read(current_user)
