import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.user import User
from star_itsm_api.services.org_access import (
    IntegrationOrganizationError,
    resolve_integration_organization_id,
)


async def require_integration_org_id(
    db: AsyncSession,
    user: User,
) -> uuid.UUID:
    try:
        return await resolve_integration_organization_id(db, user)
    except IntegrationOrganizationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
