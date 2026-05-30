"""Ensure known prototype supporter/staff accounts have correct role and UI mode on login."""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.config import settings
from star_itsm_api.core.security import ROLE_ADMIN, ROLE_SUPPORTER
from star_itsm_api.models.team import Team
from star_itsm_api.models.team_member import TeamMember
from star_itsm_api.models.user import User
from star_itsm_api.services.user_admin import sync_user_teams

# Optional bootstrap hash from env (PROTOTYPE_STAFF_PASSWORD_HASH).
# Avoid embedding credential material directly in source code.
_PROTOTYPE_STAFF_PASSWORD_HASH = settings.prototype_staff_password_hash


@dataclass(frozen=True)
class PrototypeStaffProfile:
    role: str
    ui_mode: str
    display_name: str
    team_names: tuple[str, ...]
    password_hash: str | None = None


PROTOTYPE_STAFF_BY_EMAIL: dict[str, PrototypeStaffProfile] = {
    "larrysanders@example.dk": PrototypeStaffProfile(
        role=ROLE_ADMIN,
        ui_mode="modern",
        display_name="Larrysanders",
        team_names=(),
        password_hash=_PROTOTYPE_STAFF_PASSWORD_HASH,
    ),
    "larrysanders2@example.dk": PrototypeStaffProfile(
        role=ROLE_SUPPORTER,
        ui_mode="classic",
        display_name="Larrysanders2",
        team_names=("Landssupport",),
        password_hash=_PROTOTYPE_STAFF_PASSWORD_HASH,
    ),
}


async def ensure_prototype_staff_account(db: AsyncSession, user: User) -> bool:
    """Apply profile for known demo staff emails. Returns True if user row was mutated."""
    profile = PROTOTYPE_STAFF_BY_EMAIL.get(user.email.lower().strip())
    if profile is None:
        return False

    changed = False
    if user.role != profile.role:
        user.role = profile.role
        changed = True
    if getattr(user, "ui_mode", None) != profile.ui_mode:
        user.ui_mode = profile.ui_mode
        changed = True
    if user.display_name != profile.display_name:
        user.display_name = profile.display_name
        changed = True
    if not user.is_active:
        user.is_active = True
        changed = True
    if user.deleted_at is not None:
        user.deleted_at = None
        changed = True
    if profile.password_hash and user.password_hash != profile.password_hash:
        user.password_hash = profile.password_hash
        changed = True

    if user.must_change_password:
        user.must_change_password = False
        changed = True
    if not getattr(user, "password_policy_exempt", False):
        user.password_policy_exempt = True
        changed = True

    team_ids: list[uuid.UUID] = []
    for team_name in profile.team_names:
        row = await db.execute(
            select(Team.id).where(
                Team.is_active.is_(True),
                Team.name == team_name,
            )
        )
        team_id = row.scalar_one_or_none()
        if team_id is not None:
            team_ids.append(team_id)

    if team_ids:
        existing = await db.execute(
            select(TeamMember.team_id).where(TeamMember.user_id == user.id)
        )
        existing_ids = set(existing.scalars().all())
        if set(team_ids) != existing_ids:
            await sync_user_teams(db, user.id, team_ids)
            changed = True

    if changed:
        await db.commit()
        await db.refresh(user)
    return changed
