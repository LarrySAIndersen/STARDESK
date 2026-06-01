import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import get_current_user, is_staff, require_staff
from star_itsm_api.deps import require_db
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.schemas.knowledge_article import (
    KnowledgeArticleCreate,
    KnowledgeArticlePromote,
    KnowledgeArticleRead,
    KnowledgeArticleUpdate,
    apply_create_sections,
    apply_update_sections,
    knowledge_article_to_read,
)
from star_itsm_api.services.knowledge_articles import (
    can_read_knowledge_article,
    create_knowledge_article,
    get_knowledge_article,
    list_knowledge_articles,
    promote_ticket_to_knowledge,
)
from star_itsm_api.services.org_access import user_can_access_ticket

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge-articles", tags=["knowledge-articles"])


@router.get("")
async def list_articles(
    portal: bool = Query(
        default=False,
        description="Published external articles for selvbetjening",
    ),
    status: str | None = Query(default=None, description="draft | published (staff)"),
    visibility: str | None = Query(default=None, description="internal | external (staff)"),
    q: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> list[KnowledgeArticleRead]:
    if not portal and not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    try:
        tickets = await list_knowledge_articles(
            db,
            portal=portal,
            status=status,
            visibility=visibility,
            q=q,
            limit=limit,
        )
        return [knowledge_article_to_read(t) for t in tickets]
    except Exception:
        logger.exception("Failed to list knowledge articles")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Could not load knowledge articles") from None


@router.get("/{article_id}")
async def get_article(
    article_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> KnowledgeArticleRead:
    ticket = await get_knowledge_article(db, article_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Knowledge article not found")
    if not can_read_knowledge_article(current_user, ticket):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return knowledge_article_to_read(ticket)


@router.post("", status_code=201)
async def create_article(
    payload: KnowledgeArticleCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> KnowledgeArticleRead:
    try:
        ticket = await create_knowledge_article(
            db,
            user=current_user,
            title=payload.title,
            description=payload.description or "",
            tags=payload.tags,
            knowledge_status=payload.knowledge_status,
            knowledge_visibility=payload.knowledge_visibility,
        )
        apply_create_sections(ticket, payload)
        await db.commit()
        await db.refresh(ticket)
        return knowledge_article_to_read(ticket)
    except Exception:
        logger.exception("Failed to create knowledge article")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Could not create knowledge article") from None


@router.patch("/{article_id}")
async def update_article(
    article_id: uuid.UUID,
    payload: KnowledgeArticleUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> KnowledgeArticleRead:
    ticket = await get_knowledge_article(db, article_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Knowledge article not found")
    data = payload.model_dump(exclude_unset=True)
    apply_update_sections(ticket, payload)
    for key, value in data.items():
        if key in ("description", "summary", "symptoms", "solution", "related_topics"):
            continue
        setattr(ticket, key, value)
    from datetime import UTC, datetime

    ticket.updated_at = datetime.now(UTC)
    try:
        await db.commit()
        await db.refresh(ticket)
        return knowledge_article_to_read(ticket)
    except Exception:
        logger.exception("Failed to update knowledge article")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Could not update knowledge article") from None


@router.post("/promote/{ticket_id}")
async def promote_from_ticket(
    ticket_id: uuid.UUID,
    payload: KnowledgeArticlePromote,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> KnowledgeArticleRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.is_knowledge_article:
        raise HTTPException(status_code=400, detail="Ticket is already a knowledge article")
    if not await user_can_access_ticket(db, current_user, ticket):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    try:
        promote_ticket_to_knowledge(
            db,
            ticket,
            knowledge_status=payload.knowledge_status,
            knowledge_visibility=payload.knowledge_visibility,
        )
        await db.commit()
        await db.refresh(ticket)
        return knowledge_article_to_read(ticket)
    except Exception:
        logger.exception("Failed to promote ticket to knowledge article")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Could not promote ticket") from None
