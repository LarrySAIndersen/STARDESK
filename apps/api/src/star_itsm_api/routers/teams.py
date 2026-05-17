import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import ROLE_ADMIN, ROLE_AGENT, get_current_user, require_roles
from star_itsm_api.deps import require_db
from star_itsm_api.models.team import Team
from star_itsm_api.models.user import User
from star_itsm_api.schemas.team import TeamRead
from star_itsm_api.services.org_access import get_user_organization_id
from star_itsm_api.services.teams import build_team_read, get_user_team_ids

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("", response_model=list[TeamRead])
async def list_teams(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_roles(ROLE_AGENT, ROLE_ADMIN)),
) -> list[TeamRead]:
    stmt = select(Team).where(Team.is_active.is_(True)).order_by(Team.name.asc())
    if current_user.role != ROLE_ADMIN:
        org_id = get_user_organization_id(current_user)
        if org_id is not None:
            stmt = stmt.where(Team.organization_id == org_id)
        else:
            team_ids = await get_user_team_ids(db, current_user.id)
            if not team_ids:
                return []
            stmt = stmt.where(Team.id.in_(team_ids))

    teams = (await db.execute(stmt)).scalars().all()
    return [await build_team_read(db, team) for team in teams]


@router.get("/{team_id}", response_model=TeamRead)
async def get_team(
    team_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_roles(ROLE_AGENT, ROLE_ADMIN)),
) -> TeamRead:
    team = await db.get(Team, team_id)
    if team is None or not team.is_active:
        raise HTTPException(status_code=404, detail="Group not found")

    if current_user.role != ROLE_ADMIN:
        org_id = get_user_organization_id(current_user)
        if org_id is not None:
            if team.organization_id != org_id:
                raise HTTPException(status_code=404, detail="Group not found")
        else:
            team_ids = await get_user_team_ids(db, current_user.id)
            if team_id not in team_ids:
                raise HTTPException(status_code=404, detail="Group not found")

    return await build_team_read(db, team)
