import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_link import TicketLink
from star_itsm_api.schemas.ticket import TicketSummaryRead


class HierarchyValidationError(ValueError):
    """Raised when parent/link assignment violates hierarchy rules."""


def normalize_link_pair(
    ticket_a_id: uuid.UUID,
    ticket_b_id: uuid.UUID,
) -> tuple[uuid.UUID, uuid.UUID]:
    if ticket_a_id == ticket_b_id:
        raise HierarchyValidationError("Cannot link a ticket to itself")
    if ticket_a_id < ticket_b_id:
        return ticket_a_id, ticket_b_id
    return ticket_b_id, ticket_a_id


def validate_parent_assignment(
    *,
    ticket: Ticket,
    parent: Ticket | None,
    child_count: int,
) -> None:
    if parent is None:
        return
    if ticket.deleted_at is not None:
        raise HierarchyValidationError("Ticket is deleted")
    if parent.deleted_at is not None:
        raise HierarchyValidationError("Parent ticket not found")
    if ticket.id == parent.id:
        raise HierarchyValidationError("Ticket cannot be its own parent")
    if not parent.is_major:
        raise HierarchyValidationError("Parent must be a store sag (is_major)")
    if parent.parent_ticket_id is not None:
        raise HierarchyValidationError("Parent cannot be a child ticket")
    if ticket.is_major:
        raise HierarchyValidationError("Store sager cannot have a parent")
    if child_count > 0:
        raise HierarchyValidationError("Ticket with child tickets cannot become a child")


def validate_major_link(*, source: Ticket, target: Ticket) -> None:
    for ticket, label in ((source, "Source"), (target, "Target")):
        if ticket.deleted_at is not None:
            raise HierarchyValidationError(f"{label} ticket not found")
        if not ticket.is_major:
            raise HierarchyValidationError(f"{label} must be a store sag (is_major)")
        if ticket.parent_ticket_id is not None:
            raise HierarchyValidationError(f"{label} cannot be a child ticket")


async def count_children(db: AsyncSession, ticket_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Ticket)
        .where(
            Ticket.parent_ticket_id == ticket_id,
            Ticket.deleted_at.is_(None),
        )
    )
    return int(result.scalar_one())


async def load_parent_ticket(
    db: AsyncSession,
    parent_ticket_id: uuid.UUID | None,
) -> Ticket | None:
    if parent_ticket_id is None:
        return None
    parent = await db.get(Ticket, parent_ticket_id)
    if parent is None or parent.deleted_at is not None:
        return None
    return parent


async def get_child_tickets(db: AsyncSession, parent_id: uuid.UUID) -> list[Ticket]:
    result = await db.execute(
        select(Ticket)
        .where(
            Ticket.parent_ticket_id == parent_id,
            Ticket.deleted_at.is_(None),
        )
        .order_by(Ticket.created_at.desc())
    )
    return list(result.scalars().all())


async def tickets_to_summaries(tickets: list[Ticket]) -> list[TicketSummaryRead]:
    return [
        TicketSummaryRead(
            id=ticket.id,
            ticket_number=ticket.ticket_number,
            title=ticket.title,
            status=ticket.status,
            priority=ticket.priority,
            is_major=ticket.is_major,
        )
        for ticket in tickets
    ]


async def get_related_major_tickets(db: AsyncSession, ticket_id: uuid.UUID) -> list[Ticket]:
    result = await db.execute(
        select(Ticket)
        .join(
            TicketLink,
            or_(
                (TicketLink.from_ticket_id == ticket_id) & (TicketLink.to_ticket_id == Ticket.id),
                (TicketLink.to_ticket_id == ticket_id) & (TicketLink.from_ticket_id == Ticket.id),
            ),
        )
        .where(Ticket.deleted_at.is_(None))
        .order_by(Ticket.ticket_number.asc())
    )
    return list(result.scalars().all())


async def set_parent_ticket_id(
    db: AsyncSession,
    ticket: Ticket,
    parent_ticket_id: uuid.UUID | None,
) -> None:
    child_count = await count_children(db, ticket.id)
    parent = await load_parent_ticket(db, parent_ticket_id)
    if parent_ticket_id is not None and parent is None:
        raise HierarchyValidationError("Parent ticket not found")
    validate_parent_assignment(ticket=ticket, parent=parent, child_count=child_count)
    ticket.parent_ticket_id = parent_ticket_id


async def add_related_major_link(
    db: AsyncSession,
    *,
    ticket_id: uuid.UUID,
    related_ticket_id: uuid.UUID,
) -> None:
    source = await db.get(Ticket, ticket_id)
    target = await db.get(Ticket, related_ticket_id)
    if source is None or target is None:
        raise HierarchyValidationError("Ticket not found")
    validate_major_link(source=source, target=target)
    from_id, to_id = normalize_link_pair(ticket_id, related_ticket_id)
    existing = await db.get(TicketLink, {"from_ticket_id": from_id, "to_ticket_id": to_id})
    if existing is not None:
        return
    from datetime import UTC, datetime

    db.add(
        TicketLink(
            from_ticket_id=from_id,
            to_ticket_id=to_id,
            link_type="related",
            created_at=datetime.now(UTC),
        )
    )


async def remove_related_major_link(
    db: AsyncSession,
    *,
    ticket_id: uuid.UUID,
    related_ticket_id: uuid.UUID,
) -> bool:
    from_id, to_id = normalize_link_pair(ticket_id, related_ticket_id)
    link = await db.get(TicketLink, {"from_ticket_id": from_id, "to_ticket_id": to_id})
    if link is None:
        return False
    await db.delete(link)
    return True
