import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.team import Team
from star_itsm_api.models.team_member import TeamMember
from star_itsm_api.models.user import User
from star_itsm_api.schemas.auth import ROLE_LABELS
from star_itsm_api.schemas.team import TeamMemberRead, TeamRead


async def get_user_team_ids(db: AsyncSession, user_id: uuid.UUID) -> list[uuid.UUID]:
    result = await db.execute(
        select(TeamMember.team_id).where(TeamMember.user_id == user_id)
    )
    return list(result.scalars().all())


async def user_in_team(db: AsyncSession, user_id: uuid.UUID, team_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(TeamMember.team_id).where(
            TeamMember.user_id == user_id,
            TeamMember.team_id == team_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def build_team_read(db: AsyncSession, team: Team) -> TeamRead:
    members_result = await db.execute(
        select(TeamMember, User)
        .join(User, TeamMember.user_id == User.id)
        .where(TeamMember.team_id == team.id, User.deleted_at.is_(None))
        .order_by(User.display_name.asc())
    )
    members = [
        TeamMemberRead(
            user_id=user.id,
            display_name=user.display_name,
            email=user.email,
            role=user.role,
            role_label=ROLE_LABELS.get(user.role, user.role),
            joined_at=membership.joined_at,
        )
        for membership, user in members_result.all()
    ]
    return TeamRead(
        id=team.id,
        name=team.name,
        description=team.description,
        is_active=team.is_active,
        members=members,
    )


async def sync_team_members(
    db: AsyncSession,
    team_id: uuid.UUID,
    user_ids: list[uuid.UUID],
) -> None:
    if user_ids:
        valid = await db.execute(
            select(User.id).where(
                User.id.in_(user_ids),
                User.deleted_at.is_(None),
                User.is_active.is_(True),
            )
        )
        valid_ids = set(valid.scalars().all())
        if valid_ids != set(user_ids):
            raise ValueError("invalid_user")

    existing = await db.execute(select(TeamMember).where(TeamMember.team_id == team_id))
    for membership in existing.scalars().all():
        await db.delete(membership)

    from datetime import UTC, datetime

    now = datetime.now(UTC)
    for user_id in user_ids:
        db.add(TeamMember(team_id=team_id, user_id=user_id, joined_at=now))
