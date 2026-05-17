import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.config import settings
from star_itsm_api.core.constants import SYSTEM_USER_ID
from star_itsm_api.deps import require_db
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.schemas.ticket import TicketRead
from star_itsm_api.services.routing import apply_routing
from star_itsm_api.services.sla import compute_sla_due_dates
from star_itsm_api.services.ticket_numbers import generate_ticket_number

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class EmailInboundPayload(BaseModel):
    message_id: str = Field(min_length=1, max_length=512)
    from_address: str = Field(min_length=3, max_length=320)
    subject: str = Field(default="(uden emne)", max_length=512)
    body: str = Field(min_length=1)


def _verify_webhook_secret(provided: str | None) -> None:
    if settings.webhook_secret and provided != settings.webhook_secret:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")


@router.post("/email-inbound", response_model=TicketRead, status_code=201)
async def email_inbound(
    payload: EmailInboundPayload,
    db: AsyncSession = Depends(require_db),
    x_webhook_secret: str | None = Header(default=None),
) -> TicketRead:
    _verify_webhook_secret(x_webhook_secret)

    routing = await apply_routing(
        db,
        ticket_type="incident",
        category_id=None,
        subcategory_id=None,
        priority="medium",
    )
    sla = await compute_sla_due_dates(
        db,
        priority=routing.priority,
        category_id=None,
        subcategory_id=None,
    )
    now = datetime.now(UTC)
    title = payload.subject[:256]
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number=await generate_ticket_number(db, "incident"),
        ticket_type="incident",
        title=title,
        description=payload.body,
        status="assigned" if routing.assigned_team_id else "new",
        priority=routing.priority,
        reporter_user_id=SYSTEM_USER_ID,
        assigned_team_id=routing.assigned_team_id,
        assigned_user_id=routing.assigned_user_id,
        category_id=None,
        subcategory_id=None,
        source="email",
        sla_policy_id=sla.sla_policy_id,
        response_due_at=sla.response_due_at,
        resolution_due_at=sla.resolution_due_at,
        escalation_level=0,
        created_at=now,
        deleted_at=None,
    )
    db.add(ticket)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=SYSTEM_USER_ID,
            event_type="ticket.created_from_email",
            payload={
                "message_id": payload.message_id,
                "from_address": str(payload.from_address),
            },
            created_at=now,
        )
    )
    await db.commit()
    await db.refresh(ticket)
    logger.info("Created ticket %s from email %s", ticket.ticket_number, payload.message_id)
    return TicketRead.model_validate(ticket)
