import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import get_current_user
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.sub_cause import SubCauseRead
from star_itsm_api.services.sub_causes import list_sub_causes

router = APIRouter(prefix="/sub-causes", tags=["sub-causes"])


@router.get("")
async def get_sub_causes(
    category_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(get_current_user),
) -> list[SubCauseRead]:
    return await list_sub_causes(db, category_id=category_id)
