"""Business logic for the stable integration API contract."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.constants import SYSTEM_USER_ID
from star_itsm_api.core.integration_api_auth import IntegrationClient
from star_itsm_api.models.organization import Organization
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.schemas.case_types import CaseTypeEntry
from star_itsm_api.schemas.integration_api import (
    IntegrationCaseTypeRead,
    IntegrationExternalRef,
    IntegrationTicketCreate,
    IntegrationTicketListRead,
    IntegrationTicketPatch,
    IntegrationTicketRead,
    IntegrationTicketStatus,
)
from star_itsm_api.services.case_types import (
    get_case_type_catalog,
    get_enabled_case_types,
    validate_ticket_type_id,
)
from star_itsm_api.services.routing import apply_routing
from star_itsm_api.services.sla import apply_sla_to_ticket
from star_itsm_api.services.ticket_numbers import generate_ticket_number

INTEGRATION_PROFILE_CAPABILITIES: tuple[str, ...] = (
    "case-types",
    "tickets.read",
    "tickets.create",
    "tickets.patch",
    "external-ref",
    "delta-sync",
    "case-types.configurable",
)


def _to_integration_case_type(entry: CaseTypeEntry) -> IntegrationCaseTypeRead:
    return IntegrationCaseTypeRead(
        id=entry.id,
        label_da=entry.label_da,
        prefix=entry.prefix,
        description_da=entry.description_da,
        allowed_priorities=entry.allowed_priorities,
        allowed_statuses=entry.allowed_statuses,
    )


async def list_integration_case_types(db: AsyncSession) -> list[IntegrationCaseTypeRead]:
    catalog = await get_case_type_catalog(db)
    return [_to_integration_case_type(entry) for entry in get_enabled_case_types(catalog)]


def integration_metadata_key() -> str:
    return "integration"


def _integration_block(metadata: dict | None) -> dict:
    raw = metadata or {}
    block = raw.get(integration_metadata_key())
    return block if isinstance(block, dict) else {}


def build_integration_metadata(
    external_ref: IntegrationExternalRef,
    *,
    synced_at: datetime | None = None,
) -> dict:
    return {
        integration_metadata_key(): {
            "system": external_ref.system.strip().lower(),
            "external_id": external_ref.external_id.strip(),
            "external_url": external_ref.external_url,
            "synced_at": (synced_at or datetime.now(UTC)).isoformat(),
        }
    }


def read_external_ref(metadata: dict | None) -> IntegrationExternalRef | None:
    block = _integration_block(metadata)
    system = block.get("system")
    external_id = block.get("external_id")
    if not isinstance(system, str) or not isinstance(external_id, str):
        legacy = (metadata or {}).get("external_number")
        if isinstance(legacy, str) and legacy.strip():
            return IntegrationExternalRef(system="legacy", external_id=legacy.strip())
        return None
    external_url = block.get("external_url")
    return IntegrationExternalRef(
        system=system,
        external_id=external_id,
        external_url=external_url if isinstance(external_url, str) else None,
    )


def ticket_to_integration_read(ticket: Ticket) -> IntegrationTicketRead:
    return IntegrationTicketRead(
        id=ticket.id,
        ticket_number=ticket.ticket_number,
        ticket_type=ticket.ticket_type,  # type: ignore[arg-type]
        title=ticket.title,
        description=ticket.description,
        status=ticket.status,  # type: ignore[arg-type]
        priority=ticket.priority,  # type: ignore[arg-type]
        external_ref=read_external_ref(ticket.routing_metadata),
        category_id=ticket.category_id,
        assigned_team_id=ticket.assigned_team_id,
        assigned_user_id=ticket.assigned_user_id,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


async def resolve_integration_organization_id(
    db: AsyncSession,
    client: IntegrationClient,
) -> uuid.UUID:
    if client.organization_id:
        try:
            org_uuid = uuid.UUID(client.organization_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="INTEGRATION_ORG_ID is not a valid UUID",
            ) from exc
        found = await db.scalar(
            select(Organization.id).where(
                Organization.id == org_uuid,
                Organization.is_active.is_(True),
            )
        )
        if found is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="INTEGRATION_ORG_ID does not match an active organization",
            )
        return found

    found = await db.scalar(
        select(Organization.id)
        .where(Organization.is_active.is_(True))
        .order_by(Organization.name.asc())
        .limit(1)
    )
    if found is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No active organization found for integration API",
        )
    return found


def parse_ticket_ref(ticket_ref: str) -> tuple[str, str | None, str | None]:
    """Return (mode, uuid_str|None, external_id|None) where mode is id|ext."""
    cleaned = ticket_ref.strip()
    if cleaned.startswith("ext:"):
        parts = cleaned.split(":", 2)
        if len(parts) != 3 or not parts[1].strip() or not parts[2].strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="External ref must use ext:{system}:{external_id}",
            )
        return "ext", parts[1].strip().lower(), parts[2].strip()
    try:
        uuid.UUID(cleaned)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ticket_ref must be a UUID or ext:{system}:{external_id}",
        ) from exc
    return "id", cleaned, None


async def get_ticket_for_integration(
    db: AsyncSession,
    *,
    ticket_ref: str,
    organization_id: uuid.UUID,
) -> Ticket:
    mode, id_or_system, external_id = parse_ticket_ref(ticket_ref)
    stmt: Select[tuple[Ticket]]
    if mode == "id":
        stmt = select(Ticket).where(
            Ticket.id == uuid.UUID(id_or_system),  # type: ignore[arg-type]
            Ticket.deleted_at.is_(None),
        )
    else:
        system = id_or_system
        stmt = select(Ticket).where(
            Ticket.deleted_at.is_(None),
            or_(
                Ticket.routing_metadata[integration_metadata_key()]["system"].astext == system,
                Ticket.routing_metadata["external_number"].astext == external_id,
            ),
            or_(
                Ticket.routing_metadata[integration_metadata_key()]["external_id"].astext
                == external_id,
                Ticket.routing_metadata["external_number"].astext == external_id,
            ),
        )
    ticket = await db.scalar(stmt)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if ticket.organization_id not in (None, organization_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket


async def find_ticket_by_external_ref(
    db: AsyncSession,
    *,
    external_ref: IntegrationExternalRef,
    organization_id: uuid.UUID,
) -> Ticket | None:
    system = external_ref.system.strip().lower()
    external_id = external_ref.external_id.strip()
    stmt = (
        select(Ticket)
        .where(
            Ticket.deleted_at.is_(None),
            Ticket.routing_metadata[integration_metadata_key()]["system"].astext == system,
            Ticket.routing_metadata[integration_metadata_key()]["external_id"].astext
            == external_id,
        )
        .limit(1)
    )
    ticket = await db.scalar(stmt)
    if ticket is None:
        ticket = await db.scalar(
            select(Ticket)
            .where(
                Ticket.deleted_at.is_(None),
                Ticket.routing_metadata["external_number"].astext == external_id,
            )
            .limit(1)
        )
    if ticket is None:
        return None
    if ticket.organization_id not in (None, organization_id):
        return None
    return ticket


async def list_integration_tickets(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    page: int,
    page_size: int,
    ticket_type: str | None,
    status_filter: IntegrationTicketStatus | None,
    updated_since: datetime | None,
    external_system: str | None,
) -> IntegrationTicketListRead:
    filters = [Ticket.deleted_at.is_(None)]
    filters.append(
        or_(
            Ticket.organization_id == organization_id,
            Ticket.organization_id.is_(None),
        )
    )
    if ticket_type:
        filters.append(Ticket.ticket_type == ticket_type)
    if status_filter:
        filters.append(Ticket.status == status_filter)
    if updated_since:
        filters.append(Ticket.updated_at.is_not(None))
        filters.append(Ticket.updated_at >= updated_since)
    if external_system:
        filters.append(
            Ticket.routing_metadata[integration_metadata_key()]["system"].astext
            == external_system.strip().lower()
        )

    total = int(
        await db.scalar(select(func.count()).select_from(Ticket).where(*filters)) or 0
    )
    offset = (page - 1) * page_size
    rows = await db.scalars(
        select(Ticket)
        .where(*filters)
        .order_by(Ticket.updated_at.desc().nullslast(), Ticket.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    return IntegrationTicketListRead(
        page=page,
        page_size=page_size,
        total=total,
        items=[ticket_to_integration_read(ticket) for ticket in rows.all()],
    )


async def create_integration_ticket(
    db: AsyncSession,
    *,
    _client: IntegrationClient,
    organization_id: uuid.UUID,
    payload: IntegrationTicketCreate,
) -> IntegrationTicketRead:
    await validate_ticket_type_id(db, payload.ticket_type)
    external_ref = payload.external_ref.model_copy(
        update={"system": payload.external_ref.system.strip().lower()}
    )
    existing = await find_ticket_by_external_ref(
        db,
        external_ref=external_ref,
        organization_id=organization_id,
    )
    if existing is not None:
        return ticket_to_integration_read(existing)

    routing = await apply_routing(
        db,
        ticket_type=payload.ticket_type,
        category_id=payload.category_id,
        subcategory_id=None,
        priority=payload.priority,
    )
    now = datetime.now(UTC)
    resolved_status = payload.status or ("assigned" if routing.assigned_team_id else "new")
    metadata = build_integration_metadata(external_ref, synced_at=now)
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number=await generate_ticket_number(db, payload.ticket_type),
        ticket_type=payload.ticket_type,
        title=payload.title[:256],
        description=payload.description,
        status=resolved_status,
        priority=payload.priority,
        reporter_user_id=SYSTEM_USER_ID,
        organization_id=organization_id,
        assigned_team_id=routing.assigned_team_id,
        assigned_user_id=routing.assigned_user_id,
        category_id=payload.category_id,
        subcategory_id=None,
        source="api",
        escalation_level=0,
        routing_metadata=metadata,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    db.add(ticket)
    await apply_sla_to_ticket(db, ticket, priority=payload.priority, start_at=now)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=SYSTEM_USER_ID,
            event_type="ticket.created_from_integration",
            payload={
                "system": external_ref.system,
                "external_id": external_ref.external_id,
            },
            created_at=now,
        )
    )
    await db.commit()
    await db.refresh(ticket)
    return ticket_to_integration_read(ticket)


async def patch_integration_ticket(
    db: AsyncSession,
    *,
    ticket: Ticket,
    payload: IntegrationTicketPatch,
) -> IntegrationTicketRead:
    if payload.title is not None:
        ticket.title = payload.title[:256]
    if payload.description is not None:
        ticket.description = payload.description
    if payload.status is not None:
        ticket.status = payload.status
    if payload.priority is not None:
        ticket.priority = payload.priority
    if payload.ticket_type is not None:
        await validate_ticket_type_id(db, payload.ticket_type)
        ticket.ticket_type = payload.ticket_type
    if payload.external_ref is not None:
        meta = dict(ticket.routing_metadata or {})
        meta.update(build_integration_metadata(payload.external_ref))
        ticket.routing_metadata = meta
    ticket.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(ticket)
    return ticket_to_integration_read(ticket)
