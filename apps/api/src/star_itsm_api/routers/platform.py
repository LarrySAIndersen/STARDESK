from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.http_details import INSUFFICIENT_PERMISSIONS
from star_itsm_api.core.security import get_current_user
from star_itsm_api.core.top_admin_policy import can_manage_sidebar_nav_visibility
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.platform import SidebarNavVisibilityRead, SidebarNavVisibilityUpdate
from star_itsm_api.services.nav_visibility import get_hidden_nav_ids, set_hidden_nav_ids
from star_itsm_api.services.permissions import is_staff_role

router = APIRouter(prefix="/platform", tags=["platform"])


@router.get("/sidebar-nav-visibility")
async def read_sidebar_nav_visibility(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> SidebarNavVisibilityRead:
    if not is_staff_role(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=INSUFFICIENT_PERMISSIONS
        )
    hidden = await get_hidden_nav_ids(db)
    return SidebarNavVisibilityRead(hidden_nav_ids=hidden)


@router.put("/sidebar-nav-visibility")
async def update_sidebar_nav_visibility(
    payload: SidebarNavVisibilityUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> SidebarNavVisibilityRead:
    if not can_manage_sidebar_nav_visibility(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kun topadministrator kan skjule menupunkter",
        )
    hidden = await set_hidden_nav_ids(db, payload.hidden_nav_ids)
    return SidebarNavVisibilityRead(hidden_nav_ids=hidden)
