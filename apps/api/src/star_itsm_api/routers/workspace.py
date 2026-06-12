from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import require_staff
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.workspace_layout import WorkspaceLandingRead, WorkspaceLandingUpdate
from star_itsm_api.services import workspace_layout_service

router = APIRouter(prefix="/workspace", tags=["workspace"])


@router.get("/landing", response_model=WorkspaceLandingRead)
async def get_workspace_landing(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> WorkspaceLandingRead:
    return await workspace_layout_service.get_workspace_landing(db, current_user)


@router.put("/landing", response_model=WorkspaceLandingRead)
async def save_workspace_landing(
    payload: WorkspaceLandingUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> WorkspaceLandingRead:
    try:
        return await workspace_layout_service.save_workspace_landing(db, current_user, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.post("/landing/reset", response_model=WorkspaceLandingRead)
async def reset_workspace_landing(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> WorkspaceLandingRead:
    return await workspace_layout_service.reset_workspace_landing(db, current_user)
