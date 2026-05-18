import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import ROLE_SUBMITTER, is_staff
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.models.user import User
from star_itsm_api.schemas.ticket_activity import TicketActivityItemRead, TicketTimestampsRead

_STATUS_LABELS_DA = {
    "new": "Ny",
    "assigned": "Tildelt",
    "in_progress": "I gang",
    "on_hold": "På hold",
    "resolved": "Løst",
    "closed": "Lukket",
    "cancelled": "Annulleret",
}

_PRIORITY_LABELS_DA = {
    "critical": "Kritisk",
    "high": "Høj",
    "medium": "Medium",
    "low": "Lav",
}


def ticket_timestamps_read(ticket: Ticket) -> TicketTimestampsRead:
    return TicketTimestampsRead(
        created_at=ticket.created_at,
        updated_at=getattr(ticket, "updated_at", None),
        gdpr_consent_at=getattr(ticket, "gdpr_consent_at", None),
        assigned_at=getattr(ticket, "assigned_at", None),
        in_progress_at=getattr(ticket, "in_progress_at", None),
        on_hold_at=getattr(ticket, "on_hold_at", None),
        first_response_at=getattr(ticket, "first_response_at", None),
        resolved_at=ticket.resolved_at,
        closed_at=ticket.closed_at,
        cancelled_at=getattr(ticket, "cancelled_at", None),
        last_escalation_at=ticket.last_escalation_at,
        response_due_at=ticket.response_due_at,
        resolution_due_at=ticket.resolution_due_at,
    )


def _status_label(status: str | None) -> str:
    if not status:
        return "—"
    return _STATUS_LABELS_DA.get(status, status)


def _priority_label(priority: str | None) -> str:
    if not priority:
        return "—"
    return _PRIORITY_LABELS_DA.get(priority, priority)


def _event_label(event_type: str, payload: dict) -> tuple[str, str, str | None]:
    """Return (label_da, visibility, detail)."""
    if event_type == "ticket.created":
        return "Sag oprettet", "external", payload.get("ticket_number")
    if event_type == "ticket.status_changed":
        prev = _status_label(payload.get("previous_status"))
        new = _status_label(payload.get("status"))
        return f"Status ændret til {new}", "external", f"Tidligere: {prev}"
    if event_type == "ticket.reopened":
        new = _status_label(payload.get("status"))
        return "Sag genåbnet", "external", f"Ny status: {new}"
    if event_type == "ticket.assigned":
        return "Tildeling opdateret", "internal", None
    if event_type == "comment.created":
        if payload.get("is_internal"):
            return "Intern note tilføjet", "internal", None
        return "Ekstern opdatering tilføjet", "external", None
    if event_type == "ticket.priority_changed":
        prev = _priority_label(payload.get("previous_priority"))
        new = _priority_label(payload.get("priority"))
        reason = (payload.get("reason") or "").strip()
        return f"Prioritet ændret: {prev} → {new}", "internal", reason or None
    if event_type == "ticket.metadata_changed":
        return "Sagsmetadata opdateret", "internal", None
    if event_type == "ticket.attachment.uploaded":
        filename = payload.get("filename") or "dokument"
        return f"Dokument uploadet: {filename}", "external", payload.get("scan_status")
    if event_type == "sla.escalated":
        level = payload.get("level")
        return "SLA-eskalering", "system", f"Niveau {level}" if level is not None else None
    return event_type, "internal", None


async def build_ticket_activity(
    db: AsyncSession,
    ticket: Ticket,
    user: User,
) -> list[TicketActivityItemRead]:
    try:
        return await _build_ticket_activity(db, ticket, user)
    except Exception:
        return []


async def _build_ticket_activity(
    db: AsyncSession,
    ticket: Ticket,
    user: User,
) -> list[TicketActivityItemRead]:
    hide_internal = user.role == ROLE_SUBMITTER and not is_staff(user)

    result = await db.execute(
        select(TicketEvent)
        .where(TicketEvent.ticket_id == ticket.id)
        .order_by(TicketEvent.created_at.asc())
    )
    events = list(result.scalars().all())
    if not events:
        return []

    actor_ids = {event.actor_user_id for event in events if event.actor_user_id}
    actors: dict[uuid.UUID, str] = {}
    if actor_ids:
        rows = await db.execute(select(User).where(User.id.in_(actor_ids)))
        actors = {u.id: u.display_name for u in rows.scalars().all()}

    items: list[TicketActivityItemRead] = []
    for event in events:
        label, visibility, detail = _event_label(event.event_type, event.payload or {})
        if hide_internal and visibility == "internal":
            continue
        actor_name = None
        if event.actor_user_id:
            actor_name = actors.get(event.actor_user_id)
        if visibility == "system":
            actor_name = "System"
        items.append(
            TicketActivityItemRead(
                id=event.id,
                occurred_at=event.created_at,
                event_type=event.event_type,
                label_da=label,
                actor_display_name=actor_name,
                visibility=visibility,
                detail=detail,
            )
        )
    return items
