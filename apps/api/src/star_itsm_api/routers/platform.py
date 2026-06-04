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

import json
from pathlib import Path
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/platform", tags=["platform"])


@router.get("/sbom")
async def get_sbom() -> JSONResponse:
    """
    Hent API'ens CycloneDX Software Bill of Materials (SBOM).
    """
    sbom_path = Path(__file__).parent.parent / "sbom.json"
    if not sbom_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SBOM ikke fundet. Den genereres under udrulning (deployment).",
        )
    try:
        with open(sbom_path, encoding="utf-8") as f:
            data = json.load(f)
        return JSONResponse(content=data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fejl ved indlæsning af SBOM: {str(e)}",
        )


@router.get("/sidebar-nav-visibility")
async def read_sidebar_nav_visibility(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> SidebarNavVisibilityRead:
    if not is_staff_role(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INSUFFICIENT_PERMISSIONS)
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
