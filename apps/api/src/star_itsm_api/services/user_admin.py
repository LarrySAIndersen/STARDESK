import secrets
import string
import uuid
from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.password_policy import validate_password, validate_password_for_user
from star_itsm_api.core.security import hash_password
from star_itsm_api.models.organization import Organization
from star_itsm_api.models.team import Team
from star_itsm_api.models.team_member import TeamMember
from star_itsm_api.models.user import User
from star_itsm_api.schemas.auth import ROLE_LABELS
from star_itsm_api.schemas.user_admin import (
    ASSIGNABLE_ROLES,
    OrganizationOption,
    RoleOption,
    UserAdminListItem,
    UserAdminListResponse,
    UserAdminMeta,
    UserAdminRead,
    UserTeamSummary,
    user_to_admin_read,
)
from star_itsm_api.services.user_roles import (
    attach_roles_to_user,
    fetch_user_roles,
    fetch_user_roles_bulk,
    role_labels_for_values,
    sync_user_roles,
)


async def list_organizations(db: AsyncSession) -> list[OrganizationOption]:
    result = await db.execute(
        select(Organization)
        .where(Organization.is_active.is_(True))
        .order_by(Organization.name.asc())
    )
    return [OrganizationOption(id=row.id, name=row.name) for row in result.scalars().all()]


def build_admin_meta(organizations: list[OrganizationOption]) -> UserAdminMeta:
    return UserAdminMeta(
        roles=[
            RoleOption(value=role, label=ROLE_LABELS.get(role, role)) for role in ASSIGNABLE_ROLES
        ],
        organizations=organizations,
    )


async def _team_summaries_for_users(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[UserTeamSummary]]:
    if not user_ids:
        return {}
    result = await db.execute(
        select(TeamMember.user_id, Team.id, Team.name)
        .join(Team, TeamMember.team_id == Team.id)
        .where(
            TeamMember.user_id.in_(user_ids),
            Team.is_active.is_(True),
        )
        .order_by(Team.name.asc())
    )
    grouped: dict[uuid.UUID, list[UserTeamSummary]] = defaultdict(list)
    for user_id, team_id, team_name in result.all():
        grouped[user_id].append(UserTeamSummary(id=team_id, name=team_name))
    return grouped


async def list_users_admin(
    db: AsyncSession,
    *,
    page: int,
    page_size: int,
    q: str | None,
) -> UserAdminListResponse:
    base = select(User).where(User.deleted_at.is_(None))
    if q:
        term = f"%{q.strip().lower()}%"
        team_member_ids = (
            select(TeamMember.user_id)
            .join(Team, TeamMember.team_id == Team.id)
            .where(
                Team.is_active.is_(True),
                func.lower(Team.name).like(term),
            )
        )
        base = base.where(
            or_(
                func.lower(User.email).like(term),
                func.lower(User.display_name).like(term),
                User.id.in_(team_member_ids),
            )
        )

    count_stmt = select(func.count()).select_from(base.subquery())
    total = int((await db.execute(count_stmt)).scalar_one())

    offset = (page - 1) * page_size
    users = list(
        (await db.execute(base.order_by(User.display_name.asc()).offset(offset).limit(page_size)))
        .scalars()
        .all()
    )

    org_names: dict[uuid.UUID, str] = {}
    org_ids = {u.organization_id for u in users if u.organization_id}
    if org_ids:
        org_rows = await db.execute(select(Organization).where(Organization.id.in_(org_ids)))
        org_names = {o.id: o.name for o in org_rows.scalars().all()}

    team_map = await _team_summaries_for_users(db, [u.id for u in users])
    roles_map = await fetch_user_roles_bulk(db, [u.id for u in users])
    items = [
        UserAdminListItem(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            role_label=ROLE_LABELS.get(user.role, user.role),
            roles=roles_map.get(user.id, [user.role]),
            role_labels=role_labels_for_values(
                roles_map.get(user.id, [user.role]),
                ROLE_LABELS,
            ),
            is_active=user.is_active,
            organization_name=org_names.get(user.organization_id) if user.organization_id else None,
            team_ids=[t.id for t in team_map.get(user.id, [])],
            team_names=[t.name for t in team_map.get(user.id, [])],
        )
        for user in users
    ]
    return UserAdminListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_user_admin(db: AsyncSession, user_id: uuid.UUID) -> UserAdminRead | None:
    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        return None

    org_name: str | None = None
    if user.organization_id:
        org = await db.get(Organization, user.organization_id)
        org_name = org.name if org else None

    teams = (await _team_summaries_for_users(db, [user.id])).get(user.id, [])
    roles = await fetch_user_roles(db, user.id)
    if not roles:
        roles = [user.role]
    attach_roles_to_user(user, roles)
    return user_to_admin_read(user, organization_name=org_name, teams=teams, roles=roles)


async def email_taken(db: AsyncSession, email: str, *, exclude_user_id: uuid.UUID | None) -> bool:
    stmt = select(User.id).where(
        func.lower(User.email) == email.lower().strip(),
        User.deleted_at.is_(None),
    )
    if exclude_user_id:
        stmt = stmt.where(User.id != exclude_user_id)
    return (await db.execute(stmt)).scalar_one_or_none() is not None


async def sync_user_teams(
    db: AsyncSession,
    user_id: uuid.UUID,
    team_ids: list[uuid.UUID],
) -> None:
    if team_ids:
        valid = await db.execute(
            select(Team.id).where(Team.id.in_(team_ids), Team.is_active.is_(True))
        )
        valid_ids = set(valid.scalars().all())
        if valid_ids != set(team_ids):
            raise ValueError("invalid_team")

    existing = await db.execute(select(TeamMember).where(TeamMember.user_id == user_id))
    for membership in existing.scalars().all():
        await db.delete(membership)

    now = datetime.now(UTC)
    for team_id in team_ids:
        db.add(TeamMember(team_id=team_id, user_id=user_id, joined_at=now))


async def set_user_password(db: AsyncSession, user: User, new_password: str) -> None:
    validate_password_for_user(user, new_password)
    user.password_hash = hash_password(new_password)
    if not user.password_policy_exempt:
        user.must_change_password = True
    await db.commit()


def _generate_temporary_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def create_user_admin(
    db: AsyncSession,
    *,
    email: str,
    display_name: str,
    role: str,
    roles: list[str] | None = None,
    is_active: bool,
    organization_id: uuid.UUID | None,
    team_ids: list[uuid.UUID],
    initial_password: str | None,
) -> tuple[UserAdminRead, str | None]:
    normalized_email = email.lower().strip()
    if await email_taken(db, normalized_email, exclude_user_id=None):
        raise ValueError("email_taken")

    plain_password: str
    generated: str | None = None
    if initial_password:
        validate_password(initial_password)
        plain_password = initial_password
    else:
        plain_password = _generate_temporary_password()
        generated = plain_password

    user = User(
        id=uuid.uuid4(),
        email=normalized_email,
        display_name=display_name.strip(),
        role=role,
        is_active=is_active,
        password_hash=hash_password(plain_password),
        must_change_password=True,
        organization_id=organization_id,
    )
    db.add(user)
    await db.flush()

    role_values = roles if roles else [role]
    try:
        user.role = await sync_user_roles(db, user.id, role_values)
    except ValueError:
        raise ValueError("roles_required") from None

    try:
        await sync_user_teams(db, user.id, team_ids)
    except ValueError:
        raise ValueError("invalid_team") from None

    await db.commit()
    created = await get_user_admin(db, user.id)
    if created is None:
        raise RuntimeError("user_create_failed")
    return created, generated
