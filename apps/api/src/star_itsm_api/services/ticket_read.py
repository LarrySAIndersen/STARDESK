import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.category import Category, Subcategory
from star_itsm_api.models.team import Team
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.schemas.sub_cause import SubCauseRead
from star_itsm_api.schemas.ticket import TicketDetailRead, TicketRead, TicketSummaryRead
from star_itsm_api.services.sub_causes import get_sub_causes_by_ticket_ids
from star_itsm_api.services.ticket_hierarchy import (
    get_child_tickets,
    get_related_major_tickets,
    tickets_to_summaries,
)


async def _load_list_context(
    db: AsyncSession,
    tickets: list[Ticket],
) -> tuple[
    dict[uuid.UUID, list[SubCauseRead]],
    dict[uuid.UUID, str],
    dict[uuid.UUID, str],
    dict[uuid.UUID, str],
    dict[uuid.UUID, str],
]:
    if not tickets:
        return {}, {}, {}, {}, {}

    ticket_ids = [t.id for t in tickets]
    sub_map = await get_sub_causes_by_ticket_ids(db, ticket_ids)

    category_ids = {t.category_id for t in tickets if t.category_id}
    subcategory_ids = {t.subcategory_id for t in tickets if t.subcategory_id}
    team_ids = {t.assigned_team_id for t in tickets if t.assigned_team_id}
    user_ids = {t.assigned_user_id for t in tickets if t.assigned_user_id}
    user_ids.update(t.reporter_user_id for t in tickets)

    categories: dict[uuid.UUID, str] = {}
    if category_ids:
        rows = await db.execute(select(Category).where(Category.id.in_(category_ids)))
        categories = {c.id: c.name_da for c in rows.scalars().all()}

    subcategories: dict[uuid.UUID, str] = {}
    if subcategory_ids:
        rows = await db.execute(select(Subcategory).where(Subcategory.id.in_(subcategory_ids)))
        subcategories = {s.id: s.name_da for s in rows.scalars().all()}

    teams: dict[uuid.UUID, str] = {}
    if team_ids:
        rows = await db.execute(select(Team).where(Team.id.in_(team_ids)))
        teams = {t.id: t.name for t in rows.scalars().all()}

    users: dict[uuid.UUID, str] = {}
    if user_ids:
        rows = await db.execute(select(User).where(User.id.in_(user_ids)))
        users = {u.id: u.display_name for u in rows.scalars().all()}

    return sub_map, categories, subcategories, teams, users


async def _load_hierarchy_context(
    db: AsyncSession,
    tickets: list[Ticket],
) -> tuple[dict[uuid.UUID, TicketSummaryRead], dict[uuid.UUID, int]]:
    if not tickets:
        return {}, {}

    ticket_ids = [t.id for t in tickets]
    parent_ids = {t.parent_ticket_id for t in tickets if t.parent_ticket_id}

    parents: dict[uuid.UUID, TicketSummaryRead] = {}
    if parent_ids:
        rows = await db.execute(
            select(Ticket).where(
                Ticket.id.in_(parent_ids),
                Ticket.deleted_at.is_(None),
            )
        )
        for parent in rows.scalars().all():
            parents[parent.id] = TicketSummaryRead(
                id=parent.id,
                ticket_number=parent.ticket_number,
                title=parent.title,
                status=parent.status,
                priority=parent.priority,
                is_major=parent.is_major,
            )

    child_counts: dict[uuid.UUID, int] = {}
    count_rows = await db.execute(
        select(Ticket.parent_ticket_id, func.count())
        .where(
            Ticket.parent_ticket_id.in_(ticket_ids),
            Ticket.deleted_at.is_(None),
        )
        .group_by(Ticket.parent_ticket_id)
    )
    for parent_id, count in count_rows.all():
        if parent_id is not None:
            child_counts[parent_id] = int(count)

    return parents, child_counts


def _ticket_to_read(
    ticket: Ticket,
    sub_causes: list[SubCauseRead],
    *,
    categories: dict[uuid.UUID, str],
    subcategories: dict[uuid.UUID, str],
    teams: dict[uuid.UUID, str],
    users: dict[uuid.UUID, str],
    parents: dict[uuid.UUID, TicketSummaryRead],
    child_counts: dict[uuid.UUID, int],
) -> TicketRead:
    return TicketRead(
        id=ticket.id,
        ticket_number=ticket.ticket_number,
        title=ticket.title,
        status=ticket.status,
        priority=ticket.priority,
        ticket_type=ticket.ticket_type,
        is_major=getattr(ticket, "is_major", False),
        is_shared=getattr(ticket, "is_shared", False),
        is_security_ticket=getattr(ticket, "is_security_ticket", False),
        parent_ticket_id=getattr(ticket, "parent_ticket_id", None),
        parent=parents.get(ticket.parent_ticket_id) if ticket.parent_ticket_id else None,
        child_count=child_counts.get(ticket.id, 0),
        sub_causes=sub_causes,
        category_name_da=categories.get(ticket.category_id) if ticket.category_id else None,
        subcategory_name_da=subcategories.get(ticket.subcategory_id)
        if ticket.subcategory_id
        else None,
        assigned_team_id=ticket.assigned_team_id,
        assigned_team_name=teams.get(ticket.assigned_team_id) if ticket.assigned_team_id else None,
        assigned_user_name=users.get(ticket.assigned_user_id) if ticket.assigned_user_id else None,
        reporter_display_name=users.get(ticket.reporter_user_id),
        response_due_at=ticket.response_due_at,
        resolution_due_at=ticket.resolution_due_at,
        created_at=ticket.created_at,
        updated_at=getattr(ticket, "updated_at", None),
        fault_displayed=getattr(ticket, "fault_displayed", False),
        tags=list(getattr(ticket, "tags", None) or []),
        emoji=getattr(ticket, "emoji", None),
    )


async def tickets_to_read_list(db: AsyncSession, tickets: list[Ticket]) -> list[TicketRead]:
    sub_map, categories, subcategories, teams, users = await _load_list_context(db, tickets)
    parents, child_counts = await _load_hierarchy_context(db, tickets)
    return [
        _ticket_to_read(
            ticket,
            sub_map.get(ticket.id, []),
            categories=categories,
            subcategories=subcategories,
            teams=teams,
            users=users,
            parents=parents,
            child_counts=child_counts,
        )
        for ticket in tickets
    ]


async def ticket_hierarchy_detail_extras(
    db: AsyncSession,
    ticket: Ticket,
) -> dict:
    children = await get_child_tickets(db, ticket.id)
    related: list[TicketSummaryRead] = []
    if ticket.is_major and ticket.parent_ticket_id is None:
        related = await tickets_to_summaries(await get_related_major_tickets(db, ticket.id))
    return {
        "children": await tickets_to_summaries(children),
        "related_major_tickets": related,
    }


async def ticket_to_read(db: AsyncSession, ticket: Ticket) -> TicketRead:
    items = await tickets_to_read_list(db, [ticket])
    return items[0]


async def ticket_to_detail_read(
    db: AsyncSession,
    ticket: Ticket,
    *,
    extra: dict,
    include_hierarchy: bool = True,
) -> TicketDetailRead:
    base = await ticket_to_read(db, ticket)
    hierarchy = await ticket_hierarchy_detail_extras(db, ticket) if include_hierarchy else {}
    return TicketDetailRead(**base.model_dump(), **hierarchy, **extra)
