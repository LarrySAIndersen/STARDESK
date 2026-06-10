"""Ensure known prototype supporter/staff accounts have correct role and UI mode on login."""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.demo import get_prototype_bootstrap_password
from star_itsm_api.core.security import (
    ROLE_ADMIN,
    ROLE_SUPPORTER,
    hash_password,
    verify_password,
)
from star_itsm_api.models.team import Team
from star_itsm_api.models.team_member import TeamMember
from star_itsm_api.models.user import User
from star_itsm_api.services.user_admin import sync_user_teams


@dataclass(frozen=True)
class PrototypeStaffProfile:
    role: str
    ui_mode: str
    display_name: str
    team_names: tuple[str, ...]
    prototype_password: str | None = None
    password_pepper: str | None = None


PROTOTYPE_STAFF_BY_EMAIL: dict[str, PrototypeStaffProfile] = {
    "larrysanders@example.dk": PrototypeStaffProfile(
        role=ROLE_ADMIN,
        ui_mode="modern",
        display_name="Larrysanders",
        team_names=(),
        prototype_password=None,
        password_pepper=None,
    ),
    "larrysanders2@example.dk": PrototypeStaffProfile(
        role=ROLE_SUPPORTER,
        ui_mode="classic",
        display_name="Larrysanders2",
        team_names=("Landssupport",),
        prototype_password=None,
        password_pepper=None,
    ),
}


def _apply_prototype_profile_fields(user: User, profile) -> bool:
    changed = False
    field_updates = (
        ("role", profile.role),
        ("ui_mode", profile.ui_mode),
        ("display_name", profile.display_name),
    )
    for attr, value in field_updates:
        if getattr(user, attr, None) != value:
            setattr(user, attr, value)
            changed = True
    if not user.is_active:
        user.is_active = True
        changed = True
    if user.deleted_at is not None:
        user.deleted_at = None
        changed = True
    bootstrap = get_prototype_bootstrap_password()
    password_ok = False
    if user.password_hash:
        try:
            password_ok = verify_password(bootstrap, user.password_hash)
        except ValueError:
            password_ok = False
    if not password_ok:
        user.password_hash = hash_password(bootstrap)
        changed = True
    if user.must_change_password:
        user.must_change_password = False
        changed = True
    if not getattr(user, "password_policy_exempt", False):
        user.password_policy_exempt = True
        changed = True
    return changed


async def _resolve_prototype_team_ids(db: AsyncSession, profile) -> list[uuid.UUID]:
    team_ids: list[uuid.UUID] = []
    for team_name in profile.team_names:
        row = await db.execute(
            select(Team.id).where(Team.is_active.is_(True), Team.name == team_name)
        )
        team_id = row.scalar_one_or_none()
        if team_id is not None:
            team_ids.append(team_id)
    return team_ids


async def ensure_prototype_staff_account(db: AsyncSession, user: User) -> bool:
    """Apply profile for known demo staff emails. Returns True if user row was mutated."""
    profile = PROTOTYPE_STAFF_BY_EMAIL.get(user.email.lower().strip())
    if profile is None:
        return False

    changed = _apply_prototype_profile_fields(user, profile)
    team_ids = await _resolve_prototype_team_ids(db, profile)
    if team_ids:
        existing = await db.execute(select(TeamMember.team_id).where(TeamMember.user_id == user.id))
        existing_ids = set(existing.scalars().all())
        if set(team_ids) != existing_ids:
            await sync_user_teams(db, user.id, team_ids)
            changed = True

    if changed:
        await db.commit()
        await db.refresh(user)
    return changed
