"""Multi-role assignments per user (rettighedsgrupper)."""

import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.user import User
from star_itsm_api.models.user_role import UserRoleAssignment

ROLE_SUBMITTER = "end_user"
ROLE_AGENT = "agent"
ROLE_ADMIN = "admin"
ROLE_TOP_ADMIN = "top_admin"
ROLE_SUPPORTER = "supporter"
ROLE_STARDESK_REVIEWER = "stardesk_reviewer"
ROLE_KUNDEPORTAL_2 = "kundeportal_2"

ROLE_PRIORITY: tuple[str, ...] = (
    ROLE_TOP_ADMIN,
    ROLE_ADMIN,
    ROLE_SUPPORTER,
    ROLE_AGENT,
    ROLE_KUNDEPORTAL_2,
    ROLE_STARDESK_REVIEWER,
    ROLE_SUBMITTER,
)

ALL_ASSIGNABLE_ROLES = frozenset(ROLE_PRIORITY)

ROLES_CACHE_ATTR = "_roles_cache"


def primary_role_from_set(roles: set[str]) -> str:
    for role in ROLE_PRIORITY:
        if role in roles:
            return role
    return ROLE_SUBMITTER


def role_labels_for_values(roles: list[str], labels: dict[str, str]) -> list[str]:
    return [labels.get(role, role) for role in roles]


def attach_roles_to_user(user: User, roles: list[str]) -> None:
    setattr(user, ROLES_CACHE_ATTR, frozenset(roles))


def user_role_set(user: User) -> frozenset[str]:
    cached = getattr(user, ROLES_CACHE_ATTR, None)
    if isinstance(cached, frozenset):
        return cached
    return frozenset({user.role})


def user_has_any_role(user: User, *roles: str) -> bool:
    allowed = frozenset(roles)
    return bool(user_role_set(user) & allowed)


async def fetch_user_roles(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    result = await db.execute(
        select(UserRoleAssignment.role)
        .where(UserRoleAssignment.user_id == user_id)
        .order_by(UserRoleAssignment.role.asc())
    )
    roles = list(result.scalars().all())
    if roles:
        return roles
    user = await db.get(User, user_id)
    if user is None:
        return []
    return [user.role]


async def fetch_user_roles_bulk(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[str]]:
    if not user_ids:
        return {}
    result = await db.execute(
        select(UserRoleAssignment.user_id, UserRoleAssignment.role)
        .where(UserRoleAssignment.user_id.in_(user_ids))
        .order_by(UserRoleAssignment.role.asc())
    )
    grouped: dict[uuid.UUID, list[str]] = {uid: [] for uid in user_ids}
    for user_id, role in result.all():
        grouped[user_id].append(role)
    return grouped


async def ensure_user_roles_loaded(db: AsyncSession, user: User) -> list[str]:
    cached = getattr(user, ROLES_CACHE_ATTR, None)
    if isinstance(cached, frozenset):
        return sorted(cached)
    roles = await fetch_user_roles(db, user.id)
    if not roles:
        roles = [user.role]
    attach_roles_to_user(user, roles)
    return roles


async def sync_user_roles(
    db: AsyncSession,
    user_id: uuid.UUID,
    roles: list[str],
) -> str:
    normalized = sorted({r for r in roles if r in ALL_ASSIGNABLE_ROLES})
    if not normalized:
        raise ValueError("roles_required")

    await db.execute(delete(UserRoleAssignment).where(UserRoleAssignment.user_id == user_id))
    for role in normalized:
        db.add(UserRoleAssignment(user_id=user_id, role=role))

    return primary_role_from_set(set(normalized))
