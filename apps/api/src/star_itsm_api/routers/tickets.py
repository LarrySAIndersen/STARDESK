import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.constants import SYSTEM_USER_ID
from star_itsm_api.deps import require_db
from star_itsm_api.models.comment import TicketComment
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.models.user import User
from star_itsm_api.schemas.comment import CommentCreate, CommentRead
from star_itsm_api.schemas.ticket import (
    TicketCreate,
    TicketDetailRead,
    TicketRead,
    TicketStatusUpdate,
)
from star_itsm_api.services.routing import apply_routing
from star_itsm_api.services.sla import compute_sla_due_dates
from star_itsm_api.services.ticket_numbers import generate_ticket_number

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tickets", tags=["tickets"])


async def _comment_to_read(db: AsyncSession, comment: TicketComment) -> CommentRead:
    author = await db.get(User, comment.author_user_id)
    return CommentRead(
        id=comment.id,
        body=comment.body,
        is_internal=comment.is_internal,
        author_display_name=author.display_name if author else "Ukendt",
        created_at=comment.created_at,
    )


@router.get("", response_model=list[TicketRead])
async def list_tickets(db: AsyncSession = Depends(require_db)) -> list[TicketRead]:
    try:
        result = await db.execute(
            select(Ticket)
            .where(Ticket.deleted_at.is_(None))
            .order_by(Ticket.created_at.desc())
        )
        return [TicketRead.model_validate(row) for row in result.scalars().all()]
    except Exception:
        logger.exception("Failed to list tickets")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Could not load tickets") from None


@router.post("", response_model=TicketRead, status_code=201)
async def create_ticket(
    payload: TicketCreate,
    db: AsyncSession = Depends(require_db),
) -> TicketRead:
    routing = await apply_routing(
        db,
        ticket_type=payload.ticket_type,
        category_id=payload.category_id,
        subcategory_id=payload.subcategory_id,
        priority=payload.priority,
    )
    sla = await compute_sla_due_dates(
        db,
        priority=routing.priority,
        category_id=payload.category_id,
        subcategory_id=payload.subcategory_id,
    )
    now = datetime.now(UTC)
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number=await generate_ticket_number(db, payload.ticket_type),
        ticket_type=payload.ticket_type,
        title=payload.title,
        description=payload.description,
        status="assigned" if routing.assigned_team_id else "new",
        priority=routing.priority,
        reporter_user_id=SYSTEM_USER_ID,
        assigned_team_id=routing.assigned_team_id,
        assigned_user_id=routing.assigned_user_id,
        category_id=payload.category_id,
        subcategory_id=payload.subcategory_id,
        source="portal",
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
            event_type="ticket.created",
            payload={"ticket_number": ticket.ticket_number},
            created_at=now,
        )
    )
    await db.commit()
    await db.refresh(ticket)
    return TicketRead.model_validate(ticket)


@router.get("/{ticket_id}", response_model=TicketDetailRead)
async def get_ticket(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
) -> TicketDetailRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    comments_result = await db.execute(
        select(TicketComment)
        .where(
            TicketComment.ticket_id == ticket_id,
            TicketComment.deleted_at.is_(None),
        )
        .order_by(TicketComment.created_at.asc())
    )
    comments = [
        await _comment_to_read(db, comment) for comment in comments_result.scalars().all()
    ]
    return TicketDetailRead(
        **TicketRead.model_validate(ticket).model_dump(),
        description=ticket.description,
        category_id=ticket.category_id,
        subcategory_id=ticket.subcategory_id,
        assigned_team_id=ticket.assigned_team_id,
        response_due_at=ticket.response_due_at,
        resolution_due_at=ticket.resolution_due_at,
        escalation_level=ticket.escalation_level,
        comments=comments,
    )


@router.patch("/{ticket_id}", response_model=TicketRead)
async def update_ticket_status(
    ticket_id: uuid.UUID,
    payload: TicketStatusUpdate,
    db: AsyncSession = Depends(require_db),
) -> TicketRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.status = payload.status
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=SYSTEM_USER_ID,
            event_type="ticket.status_changed",
            payload={"status": payload.status},
            created_at=datetime.now(UTC),
        )
    )
    await db.commit()
    await db.refresh(ticket)
    return TicketRead.model_validate(ticket)


@router.post("/{ticket_id}/comments", response_model=CommentRead, status_code=201)
async def create_comment(
    ticket_id: uuid.UUID,
    payload: CommentCreate,
    db: AsyncSession = Depends(require_db),
) -> CommentRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    now = datetime.now(UTC)
    comment = TicketComment(
        id=uuid.uuid4(),
        ticket_id=ticket_id,
        author_user_id=SYSTEM_USER_ID,
        body=payload.body,
        is_internal=payload.is_internal,
        created_at=now,
        deleted_at=None,
    )
    db.add(comment)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket_id,
            actor_user_id=SYSTEM_USER_ID,
            event_type="comment.created",
            payload={"comment_id": str(comment.id), "is_internal": payload.is_internal},
            created_at=now,
        )
    )
    await db.commit()
    await db.refresh(comment)
    return await _comment_to_read(db, comment)
