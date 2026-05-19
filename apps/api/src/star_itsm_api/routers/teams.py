import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import require_admin_session, require_staff
from star_itsm_api.deps import require_db
from star_itsm_api.models.team import Team
from star_itsm_api.models.user import User
from star_itsm_api.schemas.team import TeamAdminUpdate, TeamRead
from star_itsm_api.services.org_access import can_assign_to_any_team
from star_itsm_api.services.permissions import can_manage_users
from star_itsm_api.services.teams import build_team_read, get_user_team_ids, sync_team_members

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("", response_model=list[TeamRead])
async def list_teams(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> list[TeamRead]:
    stmt = select(Team).where(Team.is_active.is_(True)).order_by(Team.name.asc())
    if not can_assign_to_any_team(current_user):
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
    current_user: User = Depends(require_staff()),
) -> TeamRead:
    team = await db.get(Team, team_id)
    if team is None or not team.is_active:
        raise HTTPException(status_code=404, detail="Group not found")

    if not can_assign_to_any_team(current_user):
        team_ids = await get_user_team_ids(db, current_user.id)
        if team_id not in team_ids:
            raise HTTPException(status_code=404, detail="Group not found")

    return await build_team_read(db, team)


@router.patch("/{team_id}", response_model=TeamRead)
async def update_team_members(
    team_id: uuid.UUID,
    payload: TeamAdminUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin_session()),
) -> TeamRead:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    team = await db.get(Team, team_id)
    if team is None or not team.is_active:
        raise HTTPException(status_code=404, detail="Group not found")

    if payload.user_ids is not None:
        try:
            await sync_team_members(db, team.id, payload.user_ids)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ugyldig bruger",
            ) from None
        await db.commit()

    return await build_team_read(db, team)
