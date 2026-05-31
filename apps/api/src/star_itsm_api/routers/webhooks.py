import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.integration_auth import verify_integration_secret
from star_itsm_api.core.constants import SYSTEM_USER_ID
from star_itsm_api.deps import require_db
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.schemas.ticket import TicketRead
from star_itsm_api.services.routing import apply_routing
from star_itsm_api.services.sla import apply_sla_to_ticket
from star_itsm_api.services.ticket_numbers import generate_ticket_number

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class EmailInboundPayload(BaseModel):
    message_id: str = Field(min_length=1, max_length=512)
    from_address: str = Field(min_length=3, max_length=320)
    subject: str = Field(default="(uden emne)", max_length=512)
    body: str = Field(min_length=1)


@router.post("/email-inbound", status_code=201)
async def email_inbound(
    payload: EmailInboundPayload,
    db: AsyncSession = Depends(require_db),
    x_webhook_secret: str | None = Header(default=None),
) -> TicketRead:
    from star_itsm_api.core.config import settings

    verify_integration_secret(
        configured_secret=settings.webhook_secret,
        provided=x_webhook_secret,
        integration_name="WEBHOOK_SECRET",
    )

    routing = await apply_routing(
        db,
        ticket_type="incident",
        category_id=None,
        subcategory_id=None,
        priority="medium",
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
        escalation_level=0,
        created_at=now,
        deleted_at=None,
    )
    db.add(ticket)
    await apply_sla_to_ticket(db, ticket, priority=routing.priority, start_at=now)
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
    logger.info("Created ticket %s from inbound email webhook", ticket.ticket_number)
    return TicketRead.model_validate(ticket)
