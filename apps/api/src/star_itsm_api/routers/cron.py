import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.config import settings
from star_itsm_api.core.constants import SYSTEM_USER_ID
from star_itsm_api.core.integration_auth import verify_integration_secret
from star_itsm_api.deps import require_db
from star_itsm_api.models.team import Team
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.services.mail import send_escalation_email
from star_itsm_api.services.ticket_timestamps import touch_ticket_updated
from star_itsm_api.services.virus_scan import scan_pending_attachments

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cron", tags=["cron"])

OPEN_STATUSES = ("new", "assigned", "in_progress", "on_hold")


def _verify_cron_secret(provided: str | None) -> None:
    verify_integration_secret(
        configured_secret=settings.cron_secret,
        provided=provided,
        integration_name="CRON_SECRET",
    )


@router.post("/sla-check")
async def sla_check(
    db: AsyncSession = Depends(require_db),
    authorization: str | None = Header(default=None),
) -> dict[str, int]:
    token = authorization.removeprefix("Bearer ").strip() if authorization else None
    _verify_cron_secret(token)

    now = datetime.now(UTC)
    overdue = (
        (
            await db.execute(
                select(Ticket).where(
                    Ticket.deleted_at.is_(None),
                    Ticket.status.in_(OPEN_STATUSES),
                    Ticket.resolution_due_at.is_not(None),
                    Ticket.resolution_due_at < now,
                    Ticket.escalation_level < 3,
                )
            )
        )
        .scalars()
        .all()
    )

    escalated = 0
    for ticket in overdue:
        ticket.escalation_level += 1
        ticket.last_escalation_at = now
        touch_ticket_updated(ticket, now)
        db.add(
            TicketEvent(
                id=uuid.uuid4(),
                ticket_id=ticket.id,
                actor_user_id=SYSTEM_USER_ID,
                event_type="sla.escalated",
                payload={"level": ticket.escalation_level},
                created_at=now,
            )
        )
        if ticket.assigned_team_id:
            team = await db.get(Team, ticket.assigned_team_id)
            if team and team.escalation_email:
                await send_escalation_email(
                    to_address=team.escalation_email,
                    subject=f"SLA-eskalering: {ticket.ticket_number}",
                    body=(
                        f"Sag {ticket.ticket_number} ({ticket.title}) har overskredet "
                        f"løsningsfristen. Eskalationsniveau: {ticket.escalation_level}."
                    ),
                )
        escalated += 1

    await db.commit()
    return {"escalated": escalated, "checked_at": now.isoformat()}


@router.post("/virus-scan")
async def virus_scan_pending(
    db: AsyncSession = Depends(require_db),
    authorization: str | None = Header(default=None),
) -> dict[str, int | str]:
    token = authorization.removeprefix("Bearer ").strip() if authorization else None
    _verify_cron_secret(token)

    scanned = await scan_pending_attachments(db)
    await db.commit()
    return {
        "scanned": scanned,
        "checked_at": datetime.now(UTC).isoformat(),
    }
