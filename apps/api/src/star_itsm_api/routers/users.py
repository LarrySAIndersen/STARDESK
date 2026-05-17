import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import ROLE_TOP_ADMIN, require_admin
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.user_admin import (
    UserAdminListResponse,
    UserAdminMeta,
    UserAdminPasswordReset,
    UserAdminRead,
    UserAdminUpdate,
)
from star_itsm_api.services.permissions import can_manage_users
from star_itsm_api.services.user_admin import (
    build_admin_meta,
    email_taken,
    get_user_admin,
    list_organizations,
    list_users_admin,
    set_user_password,
    sync_user_teams,
)

router = APIRouter(prefix="/users", tags=["users"])


def _assert_can_assign_role(actor: User, new_role: str) -> None:
    if new_role == ROLE_TOP_ADMIN and actor.role != ROLE_TOP_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kun topadministrator kan tildele rollen Topadministrator",
        )


@router.get("/meta", response_model=UserAdminMeta)
async def users_meta(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> UserAdminMeta:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    organizations = await list_organizations(db)
    return build_admin_meta(organizations)


@router.get("", response_model=UserAdminListResponse)
async def list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    q: str | None = Query(default=None, max_length=128),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> UserAdminListResponse:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return await list_users_admin(db, page=page, page_size=page_size, q=q)


@router.get("/{user_id}", response_model=UserAdminRead)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> UserAdminRead:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    user = await get_user_admin(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserAdminRead)
async def update_user(
    user_id: uuid.UUID,
    payload: UserAdminUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> UserAdminRead:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=404, detail="User not found")

    updates = payload.model_dump(exclude_unset=True)

    if "role" in updates:
        _assert_can_assign_role(current_user, updates["role"])
        user.role = updates["role"]

    if "display_name" in updates:
        user.display_name = updates["display_name"].strip()

    if "email" in updates:
        email = str(updates["email"]).lower().strip()
        if await email_taken(db, email, exclude_user_id=user.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="E-mail er allerede i brug",
            )
        user.email = email

    if "is_active" in updates:
        user.is_active = updates["is_active"]

    if "organization_id" in updates:
        user.organization_id = updates["organization_id"]

    if "team_ids" in updates:
        try:
            await sync_user_teams(db, user.id, updates["team_ids"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ugyldig gruppe",
            ) from None

    await db.commit()
    updated = await get_user_admin(db, user_id)
    if updated is None:
        raise HTTPException(status_code=404, detail="User not found")
    return updated


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_user_password(
    user_id: uuid.UUID,
    payload: UserAdminPasswordReset,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> None:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=404, detail="User not found")

    await set_user_password(db, user, payload.new_password)
