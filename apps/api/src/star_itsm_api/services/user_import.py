"""Bulk import of users from CSV/JSON rows (e.g. TOPdesk person export)."""

import uuid
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.http_details import INVALID_GROUP
from star_itsm_api.core.security import (
    ROLE_ADMIN,
    ROLE_AGENT,
    ROLE_STARDESK_REVIEWER,
    ROLE_SUBMITTER,
    ROLE_SUPPORTER,
    ROLE_TOP_ADMIN,
)
from star_itsm_api.models.organization import Organization
from star_itsm_api.models.team import Team
from star_itsm_api.models.user import User
from star_itsm_api.schemas.user_admin import UserImportRequest, UserImportResult, UserImportRowError
from star_itsm_api.services.user_admin import (
    create_user_admin,
    email_taken,
    sync_user_teams,
)

OnDuplicate = Literal["skip", "update"]

_ROLE_ALIASES: dict[str, str] = {
    "end_user": ROLE_SUBMITTER,
    "slutbruger": ROLE_SUBMITTER,
    "bruger": ROLE_SUBMITTER,
    "external": ROLE_SUBMITTER,
    "ekstern": ROLE_SUBMITTER,
    "agent": ROLE_AGENT,
    "sagsbehandler": ROLE_AGENT,
    "operatør": ROLE_AGENT,
    "operator": ROLE_AGENT,
    "admin": ROLE_ADMIN,
    "administrator": ROLE_ADMIN,
    "supporter": ROLE_SUPPORTER,
    "support": ROLE_SUPPORTER,
    "top_admin": ROLE_TOP_ADMIN,
    "topadmin": ROLE_TOP_ADMIN,
    "topadministrator": ROLE_TOP_ADMIN,
    "top administrator": ROLE_TOP_ADMIN,
    "stardesk_reviewer": ROLE_STARDESK_REVIEWER,
    "stardesk reviewer": ROLE_STARDESK_REVIEWER,
    "reviewer": ROLE_STARDESK_REVIEWER,
}

_ACTIVE_TRUE = frozenset({"1", "true", "ja", "yes", "aktiv", "active", "y"})
_ACTIVE_FALSE = frozenset({"0", "false", "nej", "no", "inaktiv", "inactive", "n"})


def normalize_import_role(raw: str | None, *, default_role: str) -> str | None:
    if raw is None or not str(raw).strip():
        return default_role
    key = str(raw).strip().lower().replace("-", "_")
    if key in (ROLE_SUBMITTER, ROLE_AGENT, ROLE_ADMIN, ROLE_SUPPORTER, ROLE_TOP_ADMIN):
        return key
    return _ROLE_ALIASES.get(key)


def parse_import_is_active(raw: str | bool | None, *, default: bool = True) -> bool:
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return default
    if isinstance(raw, bool):
        return raw
    token = str(raw).strip().lower()
    if token in _ACTIVE_TRUE:
        return True
    if token in _ACTIVE_FALSE:
        return False
    return default


def _split_names(raw: str | None) -> list[str]:
    if not raw or not str(raw).strip():
        return []
    text = str(raw).strip()
    for sep in (";", "|"):
        if sep in text:
            return [part.strip() for part in text.split(sep) if part.strip()]
    return [part.strip() for part in text.split(",") if part.strip()]


def _team_ids_by_names(
    db: AsyncSession,
    names: list[str],
    *,
    teams_by_name: dict[str, uuid.UUID],
) -> tuple[list[uuid.UUID], list[str]]:
    ids: list[uuid.UUID] = []
    unknown: list[str] = []
    for name in names:
        team_id = teams_by_name.get(name.strip().lower())
        if team_id is None:
            unknown.append(name)
        else:
            ids.append(team_id)
    return ids, unknown


async def _user_by_email(db: AsyncSession, email: str) -> User | None:
    return (
        await db.execute(
            select(User).where(
                func.lower(User.email) == email,
                User.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()


async def _update_existing_from_import(
    db: AsyncSession,
    user: User,
    *,
    display_name: str,
    role: str,
    is_active: bool,
    organization_id: uuid.UUID | None,
    team_ids: list[uuid.UUID],
) -> None:
    user.display_name = display_name
    user.role = role
    user.is_active = is_active
    user.organization_id = organization_id
    await sync_user_teams(db, user.id, team_ids)
    await db.commit()


async def import_users_admin(
    db: AsyncSession,
    *,
    payload: UserImportRequest,
    actor_role: str,
) -> UserImportResult:
    team_rows = await db.execute(select(Team.id, Team.name).where(Team.is_active.is_(True)))
    teams_by_name = {name.lower(): team_id for team_id, name in team_rows.all()}

    org_rows = await db.execute(
        select(Organization.id, Organization.name).where(Organization.is_active.is_(True))
    )
    orgs_by_name = {name.lower(): org_id for org_id, name in org_rows.all()}

    created = 0
    updated = 0
    skipped = 0
    errors: list[UserImportRowError] = []

    for index, row in enumerate(payload.rows, start=1):
        email = (row.email or "").strip().lower()
        display_name = (row.display_name or "").strip()

        if not email or "@" not in email:
            errors.append(
                UserImportRowError(row=index, email=email or None, message="Ugyldig e-mail"),
            )
            continue
        if not display_name:
            errors.append(
                UserImportRowError(row=index, email=email, message="Navn mangler"),
            )
            continue

        role = normalize_import_role(row.role, default_role=payload.default_role)
        if role is None:
            errors.append(
                UserImportRowError(row=index, email=email, message=f"Ukendt rolle: {row.role}"),
            )
            continue
        if role == ROLE_TOP_ADMIN:
            errors.append(
                UserImportRowError(
                    row=index,
                    email=email,
                    message="Rollen Topadministrator kan ikke importeres",
                ),
            )
            continue

        is_active = parse_import_is_active(row.is_active)
        team_names = _split_names(row.teams)
        team_ids, unknown_teams = _team_ids_by_names(
            db, team_names, teams_by_name=teams_by_name
        )
        if unknown_teams:
            errors.append(
                UserImportRowError(
                    row=index,
                    email=email,
                    message=f"Ukendt gruppe: {', '.join(unknown_teams)}",
                ),
            )
            continue

        organization_id: uuid.UUID | None = None
        if row.organization and str(row.organization).strip():
            org_key = str(row.organization).strip().lower()
            organization_id = orgs_by_name.get(org_key)
            if organization_id is None:
                errors.append(
                    UserImportRowError(
                        row=index,
                        email=email,
                        message=f"Ukendt organisation: {row.organization}",
                    ),
                )
                continue

        existing = await _user_by_email(db, email)

        if existing is not None:
            if payload.on_duplicate == "skip":
                skipped += 1
                continue

            try:
                await _update_existing_from_import(
                    db,
                    existing,
                    display_name=display_name,
                    role=role,
                    is_active=is_active,
                    organization_id=organization_id,
                    team_ids=team_ids,
                )
            except ValueError:
                errors.append(
                    UserImportRowError(row=index, email=email, message=INVALID_GROUP),
                )
                continue
            updated += 1
            continue

        if await email_taken(db, email, exclude_user_id=None):
            skipped += 1
            continue

        try:
            await create_user_admin(
                db,
                email=email,
                display_name=display_name,
                role=role,
                is_active=is_active,
                organization_id=organization_id,
                team_ids=team_ids,
                initial_password=None,
            )
            created += 1
        except ValueError as exc:
            code = str(exc)
            if code == "email_taken":
                if payload.on_duplicate == "update":
                    user = await _user_by_email(db, email)
                    if user is None:
                        skipped += 1
                        continue
                    try:
                        await _update_existing_from_import(
                            db,
                            user,
                            display_name=display_name,
                            role=role,
                            is_active=is_active,
                            organization_id=organization_id,
                            team_ids=team_ids,
                        )
                    except ValueError:
                        errors.append(
                            UserImportRowError(row=index, email=email, message=INVALID_GROUP),
                        )
                        continue
                    updated += 1
                else:
                    skipped += 1
            elif code == "invalid_team":
                errors.append(
                    UserImportRowError(row=index, email=email, message=INVALID_GROUP),
                )
            else:
                errors.append(
                    UserImportRowError(row=index, email=email, message=code),
                )

    total = len(payload.rows)
    return UserImportResult(
        total=total,
        created=created,
        updated=updated,
        skipped=skipped,
        failed=len(errors),
        errors=errors,
    )
