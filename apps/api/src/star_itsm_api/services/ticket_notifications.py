"""Email notifications to the ticket reporter (submitter) on meaningful updates."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.config import settings
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.services.mail import send_escalation_email
from star_itsm_api.services.org_access import get_user_organization_id

logger = logging.getLogger(__name__)

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


class TicketUpdateKind(str, Enum):
    STATUS = "status"
    PRIORITY = "priority"
    ASSIGNMENT = "assignment"
    COMMENT = "comment"


@dataclass(frozen=True)
class TicketUpdateNotification:
    kind: TicketUpdateKind
    summary_da: str
    detail_da: str | None = None


def _status_label(status: str | None) -> str:
    if not status:
        return "—"
    return _STATUS_LABELS_DA.get(status, status)


def _priority_label(priority: str | None) -> str:
    if not priority:
        return "—"
    return _PRIORITY_LABELS_DA.get(priority, priority)


def _ticket_portal_url(ticket_id: uuid.UUID) -> str | None:
    if not settings.cors_origins:
        base = (settings.frontend_url or "").split(",")[0].strip()
    else:
        base = settings.cors_origins[0]
    if not base:
        return None
    return f"{base.rstrip('/')}/tickets/{ticket_id}"


def build_status_notification(*, previous_status: str, new_status: str) -> TicketUpdateNotification:
    prev = _status_label(previous_status)
    new = _status_label(new_status)
    return TicketUpdateNotification(
        kind=TicketUpdateKind.STATUS,
        summary_da=f"Status er ændret til {new}",
        detail_da=f"Tidligere status: {prev}",
    )


def build_priority_notification(
    *, previous_priority: str, new_priority: str, reason: str
) -> TicketUpdateNotification:
    prev = _priority_label(previous_priority)
    new = _priority_label(new_priority)
    return TicketUpdateNotification(
        kind=TicketUpdateKind.PRIORITY,
        summary_da=f"Prioritet er ændret fra {prev} til {new}",
        detail_da=reason.strip() or None,
    )


def build_assignment_notification() -> TicketUpdateNotification:
    return TicketUpdateNotification(
        kind=TicketUpdateKind.ASSIGNMENT,
        summary_da="Sagen er tildelt eller omfordelt",
    )


def build_comment_notification(*, actor_name: str) -> TicketUpdateNotification:
    return TicketUpdateNotification(
        kind=TicketUpdateKind.COMMENT,
        summary_da="Der er tilføjet en ny besked på din sag",
        detail_da=f"Fra: {actor_name}",
    )


def _reporter_may_receive_email(reporter: User, ticket: Ticket) -> bool:
    if reporter.deleted_at is not None or not reporter.is_active:
        return False
    email = (reporter.email or "").strip()
    if not email:
        return False
    ticket_org = ticket.organization_id
    reporter_org = get_user_organization_id(reporter)
    if ticket_org is not None and reporter_org is not None and ticket_org != reporter_org:
        return False
    return True


def _compose_email(
    *,
    ticket: Ticket,
    notification: TicketUpdateNotification,
) -> tuple[str, str]:
    subject = f"Din sag {ticket.ticket_number} er opdateret"
    lines = [
        "Hej,",
        "",
        f"Din sag «{ticket.title}» ({ticket.ticket_number}) er blevet opdateret.",
        "",
        notification.summary_da,
    ]
    if notification.detail_da:
        lines.extend(["", notification.detail_da])
    ticket_url = _ticket_portal_url(ticket.id)
    if ticket_url:
        lines.extend(["", f"Se sagen i STARdesk: {ticket_url}"])
    lines.extend(
        [
            "",
            "Med venlig hilsen",
            "STARdesk",
        ]
    )
    return subject, "\n".join(lines)


async def notify_reporter_of_ticket_update(
    db: AsyncSession,
    *,
    ticket: Ticket,
    actor: User,
    notification: TicketUpdateNotification,
) -> bool:
    """Send update email to ticket reporter. Returns True if send was attempted."""
    if actor.id == ticket.reporter_user_id:
        return False

    reporter = await db.get(User, ticket.reporter_user_id)
    if reporter is None or not _reporter_may_receive_email(reporter, ticket):
        logger.debug(
            "Skipping ticket update email for %s (no eligible reporter)",
            ticket.ticket_number,
        )
        return False

    subject, body = _compose_email(ticket=ticket, notification=notification)
    sent = await send_escalation_email(
        to_address=reporter.email.strip(),
        subject=subject,
        body=body,
    )
    if sent:
        logger.info(
            "Ticket update email sent to reporter for %s (%s)",
            ticket.ticket_number,
            notification.kind.value,
        )
    return sent
