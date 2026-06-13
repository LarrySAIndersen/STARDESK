"""Bulk import of tickets from CSV/JSON export."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.category import Category
from star_itsm_api.models.team import Team
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.models.user import User
from star_itsm_api.schemas.ticket_import import (
    TicketImportRequest,
    TicketImportResult,
    TicketImportRowError,
)
from star_itsm_api.services.routing import apply_routing
from star_itsm_api.services.sla import apply_sla_to_ticket
from star_itsm_api.services.ticket_numbers import generate_ticket_number
from star_itsm_api.services.ticket_source import resolve_ticket_source_on_create

_VALID_TYPES = frozenset({"incident", "service_request", "problem"})
_VALID_PRIORITIES = frozenset({"critical", "high", "medium", "low"})
_VALID_STATUSES = frozenset(
    {"new", "assigned", "in_progress", "on_hold", "resolved", "closed", "cancelled"}
)
_VALID_SOURCES = frozenset({"portal", "email", "phone", "chat"})

_TYPE_ALIASES: dict[str, str] = {
    "incident": "incident",
    "hændelse": "incident",
    "haendelse": "incident",
    "problem": "problem",
    "service_request": "service_request",
    "service request": "service_request",
    "anmodning": "service_request",
    "request": "service_request",
    "sr": "service_request",
}

_PRIORITY_ALIASES: dict[str, str] = {
    "critical": "critical",
    "kritisk": "critical",
    "p1": "critical",
    "high": "high",
    "høj": "high",
    "hoej": "high",
    "p2": "high",
    "medium": "medium",
    "mellem": "medium",
    "normal": "medium",
    "p3": "medium",
    "low": "low",
    "lav": "low",
    "p4": "low",
}

_STATUS_ALIASES: dict[str, str] = {
    "new": "new",
    "ny": "new",
    "open": "new",
    "åben": "new",
    "assigned": "assigned",
    "tildelt": "assigned",
    "in_progress": "in_progress",
    "in progress": "in_progress",
    "igang": "in_progress",
    "i_gang": "in_progress",
    "on_hold": "on_hold",
    "on hold": "on_hold",
    "afventer": "on_hold",
    "resolved": "resolved",
    "løst": "resolved",
    "loest": "resolved",
    "closed": "closed",
    "lukket": "closed",
    "afsluttet": "closed",
    "cancelled": "cancelled",
    "annulleret": "cancelled",
}


def normalize_import_ticket_type(raw: str | None, *, default: str) -> str | None:
    if raw is None or not str(raw).strip():
        return default if default in _VALID_TYPES else None
    key = str(raw).strip().lower().replace("-", "_")
    if key in _VALID_TYPES:
        return key
    return _TYPE_ALIASES.get(key)


def normalize_import_priority(raw: str | None, *, default: str) -> str | None:
    if raw is None or not str(raw).strip():
        return default if default in _VALID_PRIORITIES else None
    key = str(raw).strip().lower()
    if key in _VALID_PRIORITIES:
        return key
    return _PRIORITY_ALIASES.get(key)


def normalize_import_status(raw: str | None) -> str:
    if raw is None or not str(raw).strip():
        return "new"
    key = str(raw).strip().lower().replace("-", "_")
    if key in _VALID_STATUSES:
        return key
    return _STATUS_ALIASES.get(key, "new")


def normalize_import_source(raw: str | None) -> str:
    if raw is None or not str(raw).strip():
        return "email"
    key = str(raw).strip().lower()
    if key in _VALID_SOURCES:
        return key
    if key in ("import", "migration"):
        return "email"
    return "email"


def parse_import_is_major(raw: str | bool | None) -> bool:
    if raw is None:
        return False
    if isinstance(raw, bool):
        return raw
    token = str(raw).strip().lower()
    return token in ("1", "true", "ja", "yes", "y", "stor", "major")


def _ensure_description(title: str, description: str | None) -> str:
    text = (description or "").strip()
    if len(text) >= 10:
        return text
    fallback = text or title.strip()
    if len(fallback) >= 10:
        return fallback
    return f"{fallback} (importeret)"


async def _ticket_by_number(db: AsyncSession, ticket_number: str) -> Ticket | None:
    return (
        await db.execute(
            select(Ticket).where(
                func.lower(Ticket.ticket_number) == ticket_number.lower(),
                Ticket.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()


async def _user_by_email(db: AsyncSession, email: str) -> User | None:
    return (
        await db.execute(
            select(User).where(
                func.lower(User.email) == email.lower(),
                User.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()


@dataclass(frozen=True)
class _ParsedTicketImportRow:
    index: int
    title: str
    ticket_type: str
    priority: str
    status: str
    description: str
    external: str | None
    category_id: uuid.UUID | None
    assigned_team_id: uuid.UUID | None
    reporter_user_id: uuid.UUID
    source: str
    is_major: bool


def _import_row_error(
    *,
    index: int,
    message: str,
    external_number: str | None = None,
) -> TicketImportRowError:
    return TicketImportRowError(
        row=index,
        external_number=external_number,
        message=message,
    )


def _resolve_import_category(
    row,
    *,
    index: int,
    external: str | None,
    categories_by_name: dict[str, uuid.UUID],
) -> tuple[uuid.UUID | None, TicketImportRowError | None]:
    if not row.category or not str(row.category).strip():
        return None, None
    category_id = categories_by_name.get(str(row.category).strip().lower())
    if category_id is None:
        return None, _import_row_error(
            index=index,
            external_number=external,
            message=f"Ukendt kategori: {row.category}",
        )
    return category_id, None


def _resolve_import_team(
    row,
    *,
    index: int,
    external: str | None,
    teams_by_name: dict[str, uuid.UUID],
) -> tuple[uuid.UUID | None, TicketImportRowError | None]:
    if not row.team or not str(row.team).strip():
        return None, None
    assigned_team_id = teams_by_name.get(str(row.team).strip().lower())
    if assigned_team_id is None:
        return None, _import_row_error(
            index=index,
            external_number=external,
            message=f"Ukendt gruppe: {row.team}",
        )
    return assigned_team_id, None


async def _resolve_import_reporter(
    db: AsyncSession,
    row,
    *,
    index: int,
    external: str | None,
    actor: User,
) -> tuple[uuid.UUID, TicketImportRowError | None]:
    if not row.reporter_email or not str(row.reporter_email).strip():
        return actor.id, None
    reporter = await _user_by_email(db, str(row.reporter_email).strip())
    if reporter is None:
        return actor.id, _import_row_error(
            index=index,
            external_number=external,
            message=f"Ukendt indmelder: {row.reporter_email}",
        )
    return reporter.id, None


async def _parse_ticket_import_row(
    db: AsyncSession,
    row,
    *,
    index: int,
    payload: TicketImportRequest,
    actor: User,
    categories_by_name: dict[str, uuid.UUID],
    teams_by_name: dict[str, uuid.UUID],
) -> tuple[_ParsedTicketImportRow | None, TicketImportRowError | None]:
    title = (row.title or "").strip()
    if not title:
        return None, _import_row_error(index=index, message="Titel mangler")

    ticket_type = normalize_import_ticket_type(row.ticket_type, default=payload.default_ticket_type)
    if ticket_type is None:
        return None, _import_row_error(
            index=index,
            external_number=row.external_number,
            message=f"Ukendt sagstype: {row.ticket_type}",
        )

    priority = normalize_import_priority(row.priority, default=payload.default_priority)
    if priority is None:
        return None, _import_row_error(
            index=index,
            external_number=row.external_number,
            message=f"Ukendt prioritet: {row.priority}",
        )

    external = (row.external_number or "").strip()[:32] or None
    category_id, category_err = _resolve_import_category(
        row, index=index, external=external, categories_by_name=categories_by_name
    )
    if category_err is not None:
        return None, category_err

    assigned_team_id, team_err = _resolve_import_team(
        row, index=index, external=external, teams_by_name=teams_by_name
    )
    if team_err is not None:
        return None, team_err

    reporter_user_id, reporter_err = await _resolve_import_reporter(
        db, row, index=index, external=external, actor=actor
    )
    if reporter_err is not None:
        return None, reporter_err

    return _ParsedTicketImportRow(
        index=index,
        title=title,
        ticket_type=ticket_type,
        priority=priority,
        status=normalize_import_status(row.status),
        description=_ensure_description(title, row.description),
        external=external,
        category_id=category_id,
        assigned_team_id=assigned_team_id,
        reporter_user_id=reporter_user_id,
        source=normalize_import_source(row.source),
        is_major=parse_import_is_major(row.is_major),
    ), None


async def _update_existing_import_ticket(
    db: AsyncSession,
    existing: Ticket,
    parsed: _ParsedTicketImportRow,
) -> None:
    existing.title = parsed.title[:256]
    existing.description = parsed.description
    existing.ticket_type = parsed.ticket_type
    existing.priority = parsed.priority
    existing.status = parsed.status
    existing.category_id = parsed.category_id
    existing.assigned_team_id = parsed.assigned_team_id
    existing.is_major = parsed.is_major
    meta = dict(existing.routing_metadata or {})
    meta["import_source"] = "bulk_import"
    if parsed.external:
        meta["external_number"] = parsed.external
    existing.routing_metadata = meta
    existing.updated_at = datetime.now(UTC)
    await db.commit()


async def _create_import_ticket(
    db: AsyncSession,
    parsed: _ParsedTicketImportRow,
    *,
    actor: User,
    actor_org_id: uuid.UUID | None,
) -> TicketImportRowError | None:
    routing = await apply_routing(
        db,
        ticket_type=parsed.ticket_type,
        category_id=parsed.category_id,
        subcategory_id=None,
        priority=parsed.priority,
    )
    final_team_id = parsed.assigned_team_id or routing.assigned_team_id
    final_user_id = routing.assigned_user_id if not parsed.assigned_team_id else None

    now = datetime.now(UTC)
    ticket_number = parsed.external or await generate_ticket_number(db, parsed.ticket_type)
    if await _ticket_by_number(db, ticket_number):
        return _import_row_error(
            index=parsed.index,
            external_number=parsed.external,
            message=f"Sagsnummer findes allerede: {ticket_number}",
        )

    resolved_status = parsed.status
    if resolved_status == "new" and final_team_id:
        resolved_status = "assigned"

    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number=ticket_number,
        ticket_type=parsed.ticket_type,
        title=parsed.title[:256],
        description=parsed.description,
        status=resolved_status,
        priority=parsed.priority,
        reporter_user_id=parsed.reporter_user_id,
        organization_id=actor_org_id,
        assigned_team_id=final_team_id,
        assigned_user_id=final_user_id,
        category_id=parsed.category_id,
        subcategory_id=None,
        source=resolve_ticket_source_on_create(is_staff_user=True, requested=parsed.source),
        escalation_level=0,
        is_major=parsed.is_major,
        is_security_ticket=False,
        parent_ticket_id=None,
        routing_metadata={
            "import_source": "bulk_import",
            **({"external_number": parsed.external} if parsed.external else {}),
        },
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    db.add(ticket)
    await apply_sla_to_ticket(db, ticket, priority=parsed.priority, start_at=now)
    await db.flush()
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=actor.id,
            event_type="ticket.created",
            payload={
                "ticket_number": ticket.ticket_number,
                "source": "import",
                "import_source": "bulk_import",
            },
            created_at=now,
        )
    )
    await db.commit()
    return None


async def import_tickets_admin(
    db: AsyncSession,
    *,
    payload: TicketImportRequest,
    actor: User,
) -> TicketImportResult:
    team_rows = await db.execute(select(Team.id, Team.name).where(Team.is_active.is_(True)))
    teams_by_name = {name.lower(): team_id for team_id, name in team_rows.all()}

    cat_rows = await db.execute(select(Category.id, Category.name))
    categories_by_name = {name.lower(): cat_id for cat_id, name in cat_rows.all()}

    created = 0
    updated = 0
    skipped = 0
    errors: list[TicketImportRowError] = []

    actor_org_id = getattr(actor, "organization_id", None)

    for index, row in enumerate(payload.rows, start=1):
        parsed, parse_err = await _parse_ticket_import_row(
            db,
            row,
            index=index,
            payload=payload,
            actor=actor,
            categories_by_name=categories_by_name,
            teams_by_name=teams_by_name,
        )
        if parse_err is not None:
            errors.append(parse_err)
            continue
        assert parsed is not None

        existing: Ticket | None = None
        if parsed.external:
            existing = await _ticket_by_number(db, parsed.external)

        if existing is not None:
            if payload.on_duplicate == "skip":
                skipped += 1
                continue
            await _update_existing_import_ticket(db, existing, parsed)
            updated += 1
            continue

        create_err = await _create_import_ticket(
            db,
            parsed,
            actor=actor,
            actor_org_id=actor_org_id,
        )
        if create_err is not None:
            errors.append(create_err)
            continue
        created += 1

    return TicketImportResult(
        total=len(payload.rows),
        created=created,
        updated=updated,
        skipped=skipped,
        failed=len(errors),
        errors=errors,
    )
