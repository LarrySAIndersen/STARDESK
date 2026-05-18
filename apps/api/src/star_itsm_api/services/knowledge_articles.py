import uuid
from datetime import UTC, datetime

from sqlalchemy import Select, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import ROLE_SUBMITTER, is_staff
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.services.ticket_numbers import generate_ticket_number
from star_itsm_api.services.ticket_search import apply_ticket_search_filter

KNOWLEDGE_STATUS_DRAFT = "draft"
KNOWLEDGE_STATUS_PUBLISHED = "published"
KNOWLEDGE_VISIBILITY_INTERNAL = "internal"
KNOWLEDGE_VISIBILITY_EXTERNAL = "external"

KNOWLEDGE_STATUS_LABELS_DA = {
    KNOWLEDGE_STATUS_DRAFT: "Kladde",
    KNOWLEDGE_STATUS_PUBLISHED: "Udgivet",
}

KNOWLEDGE_VISIBILITY_LABELS_DA = {
    KNOWLEDGE_VISIBILITY_INTERNAL: "Intern",
    KNOWLEDGE_VISIBILITY_EXTERNAL: "Ekstern (portal)",
}


def is_portal_knowledge_reader(user: User) -> bool:
    """Slutbrugere og andre ikke-staff kan læse eksterne artikler på portalen."""
    return user.role == ROLE_SUBMITTER or not is_staff(user)


def can_read_knowledge_article(user: User, ticket: Ticket) -> bool:
    if not getattr(ticket, "is_knowledge_article", False):
        return False
    if is_staff(user):
        return True
    if ticket.knowledge_status != KNOWLEDGE_STATUS_PUBLISHED:
        return False
    return ticket.knowledge_visibility == KNOWLEDGE_VISIBILITY_EXTERNAL


def apply_knowledge_only(stmt: Select[tuple[Ticket]]) -> Select[tuple[Ticket]]:
    return stmt.where(Ticket.is_knowledge_article.is_(True))


def exclude_knowledge_articles(stmt: Select[tuple[Ticket]]) -> Select[tuple[Ticket]]:
    return stmt.where(Ticket.is_knowledge_article.is_(False))


def apply_portal_published_filter(stmt: Select[tuple[Ticket]]) -> Select[tuple[Ticket]]:
    return stmt.where(
        Ticket.is_knowledge_article.is_(True),
        Ticket.knowledge_status == KNOWLEDGE_STATUS_PUBLISHED,
        Ticket.knowledge_visibility == KNOWLEDGE_VISIBILITY_EXTERNAL,
    )


def apply_staff_knowledge_filters(
    stmt: Select[tuple[Ticket]],
    *,
    status: str | None,
    visibility: str | None,
) -> Select[tuple[Ticket]]:
    stmt = apply_knowledge_only(stmt)
    if status is not None:
        stmt = stmt.where(Ticket.knowledge_status == status)
    if visibility is not None:
        stmt = stmt.where(Ticket.knowledge_visibility == visibility)
    return stmt


async def list_knowledge_articles(
    db: AsyncSession,
    *,
    portal: bool,
    status: str | None,
    visibility: str | None,
    q: str | None,
    limit: int,
) -> list[Ticket]:
    stmt = select(Ticket).where(Ticket.deleted_at.is_(None))
    if portal:
        stmt = apply_portal_published_filter(stmt)
    else:
        stmt = apply_staff_knowledge_filters(
            stmt,
            status=status,
            visibility=visibility,
        )
    stmt = apply_ticket_search_filter(stmt, q)
    stmt = stmt.order_by(Ticket.updated_at.desc().nullslast(), Ticket.created_at.desc()).limit(
        limit
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_knowledge_article(db: AsyncSession, article_id: uuid.UUID) -> Ticket | None:
    result = await db.execute(
        select(Ticket).where(
            Ticket.id == article_id,
            Ticket.deleted_at.is_(None),
            Ticket.is_knowledge_article.is_(True),
        )
    )
    return result.scalar_one_or_none()


async def create_knowledge_article(
    db: AsyncSession,
    *,
    user: User,
    title: str,
    description: str,
    tags: list[str],
    knowledge_status: str,
    knowledge_visibility: str,
) -> Ticket:
    now = datetime.now(UTC)
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number=await generate_ticket_number(db, "knowledge_article"),
        ticket_type="incident",
        title=title,
        description=description,
        status="closed",
        priority="low",
        reporter_user_id=user.id,
        organization_id=getattr(user, "organization_id", None),
        source="knowledge",
        created_at=now,
        updated_at=now,
        is_knowledge_article=True,
        knowledge_status=knowledge_status,
        knowledge_visibility=knowledge_visibility,
        tags=tags,
    )
    db.add(ticket)
    return ticket


async def promote_ticket_to_knowledge(
    db: AsyncSession,
    ticket: Ticket,
    *,
    knowledge_status: str,
    knowledge_visibility: str,
) -> Ticket:
    now = datetime.now(UTC)
    ticket.is_knowledge_article = True
    ticket.knowledge_status = knowledge_status
    ticket.knowledge_visibility = knowledge_visibility
    ticket.updated_at = now
    if ticket.status not in ("resolved", "closed"):
        ticket.status = "closed"
        ticket.closed_at = ticket.closed_at or now
    return ticket
