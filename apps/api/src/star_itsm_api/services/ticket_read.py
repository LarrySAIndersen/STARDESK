import logging
import time
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.constants import SYSTEM_USER_ID
from star_itsm_api.models.category import Category, Subcategory
from star_itsm_api.models.team import Team
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.schemas.sub_cause import SubCauseRead
from star_itsm_api.schemas.ticket import TicketDetailRead, TicketRead, TicketSummaryRead
from star_itsm_api.services.db_resilience import rollback_session
from star_itsm_api.services.knowledge_articles import (
    KNOWLEDGE_STATUS_LABELS_DA,
    KNOWLEDGE_VISIBILITY_LABELS_DA,
)
from star_itsm_api.services.sla_enrichment import sla_fields_for_ticket
from star_itsm_api.services.sla_settings_store import SlaRuntimeSettings, get_sla_runtime_settings
from star_itsm_api.services.sub_causes import get_sub_causes_by_ticket_ids
from star_itsm_api.services.ticket_hierarchy import (
    get_child_tickets,
    get_related_major_tickets,
    tickets_to_summaries,
)
from star_itsm_api.services.ticket_routing import _TeamRef, build_ticket_routing

logger = logging.getLogger(__name__)

SYSTEM_REPORTER_DISPLAY_NAME = "System"
_ACTIVE_TEAMS_TTL_SECONDS = 300.0
_active_teams_cache: tuple[float, list[_TeamRef]] | None = None


async def load_user_display_names(
    db: AsyncSession,
    user_ids: set[uuid.UUID],
) -> dict[uuid.UUID, str]:
    """Resolve display names including inactive/deleted users (for ticket reporters)."""
    if not user_ids:
        return {}
    try:
        rows = await db.execute(select(User).where(User.id.in_(user_ids)))
        names: dict[uuid.UUID, str] = {}
        for user in rows.scalars().all():
            names[user.id] = user.display_name
        for user_id in user_ids:
            if user_id not in names and user_id == SYSTEM_USER_ID:
                names[user_id] = SYSTEM_REPORTER_DISPLAY_NAME
        return names
    except Exception:
        logger.warning("Could not load user display names; returning empty map", exc_info=True)
        await rollback_session(db)
        names = {}
        for user_id in user_ids:
            if user_id == SYSTEM_USER_ID:
                names[user_id] = SYSTEM_REPORTER_DISPLAY_NAME
        return names


async def resolve_reporter_display_name(
    db: AsyncSession,
    reporter_user_id: uuid.UUID,
) -> str | None:
    names = await load_user_display_names(db, {reporter_user_id})
    return names.get(reporter_user_id)


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
        users = await load_user_display_names(db, user_ids)

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
    active_teams: list[_TeamRef] | None = None,
    sla_settings: SlaRuntimeSettings | None = None,
) -> TicketRead:
    sla = sla_fields_for_ticket(ticket, settings=sla_settings)
    ka_status = getattr(ticket, "knowledge_status", None)
    ka_visibility = getattr(ticket, "knowledge_visibility", None)
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
        reporter_user_id=ticket.reporter_user_id,
        reporter_display_name=users.get(ticket.reporter_user_id),
        response_due_at=sla["response_due_at"],
        resolution_due_at=sla["resolution_due_at"],
        sla_remaining_seconds=sla["sla_remaining_seconds"],
        sla_breached=sla["sla_breached"],
        created_at=ticket.created_at,
        updated_at=getattr(ticket, "updated_at", None),
        fault_displayed=getattr(ticket, "fault_displayed", False),
        tags=list(getattr(ticket, "tags", None) or []),
        emoji=getattr(ticket, "emoji", None),
        routing=build_ticket_routing(
            ticket,
            category_name_da=categories.get(ticket.category_id) if ticket.category_id else None,
            sub_causes_count=len(sub_causes),
            teams=active_teams,
        ),
        is_knowledge_article=getattr(ticket, "is_knowledge_article", False),
        knowledge_status=ka_status,
        knowledge_status_label_da=KNOWLEDGE_STATUS_LABELS_DA.get(ka_status, ka_status)
        if ka_status
        else None,
        knowledge_visibility=ka_visibility,
        knowledge_visibility_label_da=KNOWLEDGE_VISIBILITY_LABELS_DA.get(
            ka_visibility, ka_visibility
        )
        if ka_visibility
        else None,
        source=getattr(ticket, "source", None) or "portal",
    )


async def _load_active_teams(db: AsyncSession) -> list[_TeamRef]:
    global _active_teams_cache
    now = time.monotonic()
    if _active_teams_cache is not None:
        cached_at, cached = _active_teams_cache
        if now - cached_at < _ACTIVE_TEAMS_TTL_SECONDS:
            return cached
    rows = await db.execute(select(Team).where(Team.is_active.is_(True)).order_by(Team.name.asc()))
    refs = [_TeamRef(id=team.id, name=team.name) for team in rows.scalars().all()]
    _active_teams_cache = (now, refs)
    return refs


async def tickets_to_read_list(db: AsyncSession, tickets: list[Ticket]) -> list[TicketRead]:
    if not tickets:
        return []
    try:
        sub_map, categories, subcategories, teams, users = await _load_list_context(db, tickets)
        parents, child_counts = await _load_hierarchy_context(db, tickets)
        active_teams = await _load_active_teams(db)
        sla_settings = await get_sla_runtime_settings(db)
    except Exception:
        logger.exception("Ticket list context query failed; using minimal payloads")
        await rollback_session(db)
        return [await _fallback_ticket_read_async(db, ticket) for ticket in tickets]

    reads: list[TicketRead] = []
    for ticket in tickets:
        try:
            reads.append(
                _ticket_to_read(
                    ticket,
                    sub_map.get(ticket.id, []),
                    categories=categories,
                    subcategories=subcategories,
                    teams=teams,
                    users=users,
                    parents=parents,
                    child_counts=child_counts,
                    active_teams=active_teams,
                    sla_settings=sla_settings,
                )
            )
        except Exception:
            logger.exception("Failed to serialize ticket %s", ticket.id)
            reads.append(await _fallback_ticket_read_async(db, ticket))
    return reads


async def ticket_hierarchy_detail_extras(
    db: AsyncSession,
    ticket: Ticket,
) -> dict:
    try:
        children = await get_child_tickets(db, ticket.id)
        related: list[TicketSummaryRead] = []
        if ticket.is_major and ticket.parent_ticket_id is None:
            related = tickets_to_summaries(await get_related_major_tickets(db, ticket.id))
        return {
            "children": tickets_to_summaries(children),
            "related_major_tickets": related,
        }
    except Exception:
        logger.warning("Could not load ticket hierarchy for %s", ticket.id, exc_info=True)
        await rollback_session(db)
        return {"children": [], "related_major_tickets": []}


def _fallback_ticket_read(
    ticket: Ticket,
    *,
    reporter_display_name: str | None = None,
) -> TicketRead:
    """Minimal ticket payload when joined list context queries fail."""
    sla = sla_fields_for_ticket(ticket)
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
        assigned_team_id=ticket.assigned_team_id,
        reporter_user_id=ticket.reporter_user_id,
        reporter_display_name=reporter_display_name,
        response_due_at=sla["response_due_at"],
        resolution_due_at=sla["resolution_due_at"],
        sla_remaining_seconds=sla["sla_remaining_seconds"],
        sla_breached=sla["sla_breached"],
        created_at=ticket.created_at,
        updated_at=getattr(ticket, "updated_at", None),
        fault_displayed=getattr(ticket, "fault_displayed", False),
        tags=list(getattr(ticket, "tags", None) or []),
        emoji=getattr(ticket, "emoji", None),
        source=getattr(ticket, "source", None) or "portal",
    )


async def _fallback_ticket_read_async(db: AsyncSession, ticket: Ticket) -> TicketRead:
    reporter_name = await resolve_reporter_display_name(db, ticket.reporter_user_id)
    return _fallback_ticket_read(ticket, reporter_display_name=reporter_name)


async def ticket_to_read(db: AsyncSession, ticket: Ticket) -> TicketRead:
    try:
        items = await tickets_to_read_list(db, [ticket])
        read = items[0]
        if read.reporter_display_name is None:
            reporter_name = await resolve_reporter_display_name(db, ticket.reporter_user_id)
            if reporter_name is not None:
                return read.model_copy(update={"reporter_display_name": reporter_name})
        return read
    except Exception:
        return await _fallback_ticket_read_async(db, ticket)


async def ticket_to_detail_read(
    db: AsyncSession,
    ticket: Ticket,
    *,
    extra: dict,
    include_hierarchy: bool = True,
) -> TicketDetailRead:
    base = await ticket_to_read(db, ticket)
    hierarchy = await ticket_hierarchy_detail_extras(db, ticket) if include_hierarchy else {}
    payload = {**base.model_dump(), **hierarchy, **extra}
    try:
        return TicketDetailRead(**payload)
    except Exception:
        payload["intelligence"] = None
        return TicketDetailRead(**payload)
