import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import (
    ROLE_TOP_ADMIN,
    get_current_user,
    require_admin,
    require_admin_session,
)
from star_itsm_api.core.top_admin_policy import (
    assert_may_assign_role,
    can_hold_top_admin_role,
    role_after_top_admin_policy,
)
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.user_admin import (
    UserAdminCreate,
    UserAdminCreated,
    UserAdminListResponse,
    UserAdminMeta,
    UserAdminPasswordReset,
    UserAdminRead,
    UserAdminUpdate,
    UserImportRequest,
    UserImportResult,
)
from star_itsm_api.services.permissions import can_manage_users
from star_itsm_api.schemas.auth import UserRead, user_to_read
from star_itsm_api.services.avatars import (
    resolve_avatar_file,
    resolve_avatar_media_type,
    save_user_avatar,
)
from star_itsm_api.services.org_access import get_user_organization_id
from star_itsm_api.services.user_admin import (
    build_admin_meta,
    create_user_admin,
    email_taken,
    get_user_admin,
    list_organizations,
    list_users_admin,
    set_user_password,
    sync_user_teams,
)
from star_itsm_api.services.user_import import import_users_admin
from star_itsm_api.models.organization import Organization

router = APIRouter(prefix="/users", tags=["users"])


def _assert_can_assign_role(actor: User, new_role: str, *, target_email: str) -> None:
    try:
        assert_may_assign_role(actor=actor, target_email=target_email, new_role=new_role)
    except ValueError as exc:
        code = str(exc)
        if code == "top_admin_reserved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Rollen Topadministrator er reserveret til én bestemt konto",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kun topadministrator kan tildele rollen Topadministrator",
        ) from exc


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


@router.post("/import", response_model=UserImportResult)
async def import_users(
    payload: UserImportRequest,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin_session()),
) -> UserImportResult:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if payload.default_role == ROLE_TOP_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Rollen Topadministrator kan ikke importeres",
        )
    return await import_users_admin(
        db,
        payload=payload,
        actor_role=current_user.role,
    )


@router.post("", response_model=UserAdminCreated, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserAdminCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin_session()),
) -> UserAdminCreated:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    role = payload.role
    organization_id = payload.organization_id
    team_ids = list(payload.team_ids)

    if payload.clone_from_user_id is not None:
        source = await get_user_admin(db, payload.clone_from_user_id)
        if source is None:
            raise HTTPException(status_code=404, detail="Kildebruger blev ikke fundet")
        role = source.role
        organization_id = source.organization_id
        team_ids = [team.id for team in source.teams]

    email = payload.email.lower().strip()
    role = role_after_top_admin_policy(email, role)
    _assert_can_assign_role(current_user, role, target_email=email)

    try:
        created, temporary_password = await create_user_admin(
            db,
            email=email,
            display_name=payload.display_name,
            role=role,
            is_active=payload.is_active,
            organization_id=organization_id,
            team_ids=team_ids,
            initial_password=payload.initial_password,
        )
    except ValueError as exc:
        code = str(exc)
        if code == "email_taken":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="E-mail skal være unik",
            ) from exc
        if code == "clone_source_not_found":
            raise HTTPException(
                status_code=404,
                detail="Kildebruger blev ikke fundet",
            ) from exc
        if code == "invalid_team":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ugyldig gruppe",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=code,
        ) from exc

    return UserAdminCreated(user=created, temporary_password=temporary_password)


@router.post("/me/avatar", response_model=UserRead)
async def upload_my_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> UserRead:
    await save_user_avatar(db, current_user, file)
    await db.refresh(current_user)
    org_id = get_user_organization_id(current_user)
    org_name = None
    if org_id is not None:
        org = await db.get(Organization, org_id)
        org_name = org.name if org else None
    return user_to_read(current_user, organization_name=org_name)


@router.get("/{user_id}/avatar")
async def get_user_avatar(
    user_id: uuid.UUID,
    _current_user: User = Depends(get_current_user),
) -> FileResponse:
    path = resolve_avatar_file(user_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Avatar not found")
    return FileResponse(path, media_type=resolve_avatar_media_type(path))


@router.get("/{user_id}", response_model=UserAdminRead)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> UserAdminRead:
    is_self = current_user.id == user_id
    if not can_manage_users(current_user) and not is_self:
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
    current_user: User = Depends(require_admin_session()),
) -> UserAdminRead:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=404, detail="User not found")

    updates = payload.model_dump(exclude_unset=True)

    if "role" in updates:
        target_email = (
            str(updates["email"]).lower().strip()
            if "email" in updates
            else user.email
        )
        new_role = role_after_top_admin_policy(target_email, updates["role"])
        _assert_can_assign_role(current_user, new_role, target_email=target_email)
        user.role = new_role

    if "display_name" in updates:
        user.display_name = updates["display_name"].strip()

    if "email" in updates:
        email = str(updates["email"]).lower().strip()
        if user.role == ROLE_TOP_ADMIN and not can_hold_top_admin_role(email):
            user.role = ROLE_ADMIN
        if await email_taken(db, email, exclude_user_id=user.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="E-mail er allerede i brug",
            )
        user.email = email

    if "is_active" in updates:
        user.is_active = updates["is_active"]

    if "password_policy_exempt" in updates:
        user.password_policy_exempt = updates["password_policy_exempt"]
        if user.password_policy_exempt:
            user.must_change_password = False

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
    current_user: User = Depends(require_admin_session()),
) -> None:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        await set_user_password(db, user, payload.new_password)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
