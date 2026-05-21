"""Bulk import of tickets from TOPdesk CSV/JSON export."""

import uuid
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
    if key in ("topdesk", "import", "migration"):
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
    return f"{fallback} (importeret fra TOPdesk)"


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
        title = (row.title or "").strip()
        if not title:
            errors.append(
                TicketImportRowError(row=index, message="Titel mangler"),
            )
            continue

        ticket_type = normalize_import_ticket_type(
            row.ticket_type, default=payload.default_ticket_type
        )
        if ticket_type is None:
            errors.append(
                TicketImportRowError(
                    row=index,
                    external_number=row.external_number,
                    message=f"Ukendt sagstype: {row.ticket_type}",
                ),
            )
            continue

        priority = normalize_import_priority(row.priority, default=payload.default_priority)
        if priority is None:
            errors.append(
                TicketImportRowError(
                    row=index,
                    external_number=row.external_number,
                    message=f"Ukendt prioritet: {row.priority}",
                ),
            )
            continue

        status = normalize_import_status(row.status)
        description = _ensure_description(title, row.description)
        external = (row.external_number or "").strip()[:32] or None

        category_id = None
        if row.category and str(row.category).strip():
            category_id = categories_by_name.get(str(row.category).strip().lower())
            if category_id is None:
                errors.append(
                    TicketImportRowError(
                        row=index,
                        external_number=external,
                        message=f"Ukendt kategori: {row.category}",
                    ),
                )
                continue

        assigned_team_id = None
        if row.team and str(row.team).strip():
            assigned_team_id = teams_by_name.get(str(row.team).strip().lower())
            if assigned_team_id is None:
                errors.append(
                    TicketImportRowError(
                        row=index,
                        external_number=external,
                        message=f"Ukendt gruppe: {row.team}",
                    ),
                )
                continue

        reporter_user_id = actor.id
        if row.reporter_email and str(row.reporter_email).strip():
            reporter = await _user_by_email(db, str(row.reporter_email).strip())
            if reporter is None:
                errors.append(
                    TicketImportRowError(
                        row=index,
                        external_number=external,
                        message=f"Ukendt indmelder: {row.reporter_email}",
                    ),
                )
                continue
            reporter_user_id = reporter.id

        existing: Ticket | None = None
        if external:
            existing = await _ticket_by_number(db, external)

        if existing is not None:
            if payload.on_duplicate == "skip":
                skipped += 1
                continue
            existing.title = title[:256]
            existing.description = description
            existing.ticket_type = ticket_type
            existing.priority = priority
            existing.status = status
            existing.category_id = category_id
            existing.assigned_team_id = assigned_team_id
            existing.is_major = parse_import_is_major(row.is_major)
            meta = dict(existing.routing_metadata or {})
            meta["import_source"] = "topdesk"
            if external:
                meta["external_number"] = external
            existing.routing_metadata = meta
            existing.updated_at = datetime.now(UTC)
            await db.commit()
            updated += 1
            continue

        routing = await apply_routing(
            db,
            ticket_type=ticket_type,
            category_id=category_id,
            subcategory_id=None,
            priority=priority,
        )
        final_team_id = assigned_team_id or routing.assigned_team_id
        final_user_id = routing.assigned_user_id if not assigned_team_id else None

        now = datetime.now(UTC)
        ticket_number = external or await generate_ticket_number(db, ticket_type)
        if await _ticket_by_number(db, ticket_number):
            errors.append(
                TicketImportRowError(
                    row=index,
                    external_number=external,
                    message=f"Sagsnummer findes allerede: {ticket_number}",
                ),
            )
            continue

        resolved_status = status
        if resolved_status == "new" and final_team_id:
            resolved_status = "assigned"

        source = normalize_import_source(row.source)
        ticket = Ticket(
            id=uuid.uuid4(),
            ticket_number=ticket_number,
            ticket_type=ticket_type,
            title=title[:256],
            description=description,
            status=resolved_status,
            priority=priority,
            reporter_user_id=reporter_user_id,
            organization_id=actor_org_id,
            assigned_team_id=final_team_id,
            assigned_user_id=final_user_id,
            category_id=category_id,
            subcategory_id=None,
            source=resolve_ticket_source_on_create(is_staff_user=True, requested=source),
            escalation_level=0,
            is_major=parse_import_is_major(row.is_major),
            is_security_ticket=False,
            parent_ticket_id=None,
            routing_metadata={
                "import_source": "topdesk",
                **({"external_number": external} if external else {}),
            },
            created_at=now,
            updated_at=now,
            deleted_at=None,
        )
        db.add(ticket)
        await apply_sla_to_ticket(db, ticket, priority=priority, start_at=now)
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
                    "import_source": "topdesk",
                },
                created_at=now,
            )
        )
        await db.commit()
        created += 1

    return TicketImportResult(
        total=len(payload.rows),
        created=created,
        updated=updated,
        skipped=skipped,
        failed=len(errors),
        errors=errors,
    )
