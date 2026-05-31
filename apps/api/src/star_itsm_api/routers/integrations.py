from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import require_staff
from star_itsm_api.deps import require_db
from star_itsm_api.models.organization import Organization
from star_itsm_api.models.user import User
from star_itsm_api.routers.integration_org import require_integration_org_id
from star_itsm_api.schemas.integration import IntegrationScopeRead

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/scope")
async def integration_scope(
    current_user: User = Depends(require_staff()),
    db: AsyncSession = Depends(require_db),
) -> IntegrationScopeRead:
    """Organisation used for Slack/Gmail (resolved for SF admins without org)."""
    org_id = await require_integration_org_id(db, current_user)
    row = await db.execute(select(Organization.name).where(Organization.id == org_id))
    name = row.scalar_one_or_none() or "Ukendt organisation"
    return IntegrationScopeRead(organization_id=org_id, organization_name=name)
