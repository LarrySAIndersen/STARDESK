"""Kanban board CRUD, explicit card membership, and column management."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import is_staff
from star_itsm_api.models.kanban import (
    KANBAN_ROLE_OWNER,
    KanbanBoard,
    KanbanBoardMember,
    KanbanBoardTicket,
    KanbanColumn,
)
from star_itsm_api.models.team import Team
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.models.user import User
from star_itsm_api.schemas.kanban import (
    KanbanBoardCreate,
    KanbanBoardDetailRead,
    KanbanBoardMemberRead,
    KanbanBoardMemberWrite,
    KanbanBoardSummaryRead,
    KanbanBoardUpdate,
    KanbanCardAdd,
    KanbanCardRead,
    KanbanColumnCreate,
    KanbanColumnRead,
    KanbanColumnUpdate,
    KanbanColumnWithCardsRead,
    KanbanTicketSearchResult,
)
from star_itsm_api.schemas.ticket import TicketCreate, TicketRead
from star_itsm_api.services.kanban_access import (
    resolve_member_role,
    sees_all_boards,
    user_can_delete_board,
    user_can_delete_tickets,
    user_can_edit_board,
    user_can_move_cards,
    user_can_remove_cards,
    user_can_view_board,
)
from star_itsm_api.services.kanban_defaults import build_columns_for_board
from star_itsm_api.services.knowledge_articles import exclude_knowledge_articles
from star_itsm_api.services.org_access import apply_ticket_list_filter, get_user_organization_id
from star_itsm_api.services.reports import is_reopen_transition
from star_itsm_api.services.routing import apply_routing
from star_itsm_api.services.sla import apply_sla_to_ticket
from star_itsm_api.services.ticket_numbers import generate_ticket_number
from star_itsm_api.services.ticket_read import tickets_to_read_list
from star_itsm_api.services.ticket_source import resolve_ticket_source_on_create
from star_itsm_api.services.ticket_timestamps import (
    apply_status_milestone_timestamps,
    maybe_set_assigned_at,
)


async def _load_member_maps(
    db: AsyncSession,
    board_ids: list[uuid.UUID],
) -> tuple[dict[uuid.UUID, dict[uuid.UUID, str]], dict[uuid.UUID, list[KanbanBoardMember]]]:
    if not board_ids:
        return {}, {}
    rows = (
        (
            await db.execute(
                select(KanbanBoardMember).where(KanbanBoardMember.board_id.in_(board_ids))
            )
        )
        .scalars()
        .all()
    )
    role_by_board: dict[uuid.UUID, dict[uuid.UUID, str]] = {}
    members_by_board: dict[uuid.UUID, list[KanbanBoardMember]] = {}
    for member in rows:
        role_by_board.setdefault(member.board_id, {})[member.user_id] = member.role
        members_by_board.setdefault(member.board_id, []).append(member)
    return role_by_board, members_by_board


async def _list_board_columns(db: AsyncSession, board_id: uuid.UUID) -> list[KanbanColumn]:
    result = await db.execute(
        select(KanbanColumn)
        .where(KanbanColumn.board_id == board_id)
        .order_by(KanbanColumn.position.asc())
    )
    return list(result.scalars().all())


async def _team_names(db: AsyncSession, team_ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not team_ids:
        return {}
    rows = await db.execute(select(Team).where(Team.id.in_(team_ids)))
    return {t.id: t.name for t in rows.scalars().all()}


async def _member_reads(
    db: AsyncSession,
    members: list[KanbanBoardMember],
) -> list[KanbanBoardMemberRead]:
    if not members:
        return []
    user_ids = [m.user_id for m in members]
    rows = await db.execute(select(User).where(User.id.in_(user_ids)))
    users = {u.id: u for u in rows.scalars().all()}
    result: list[KanbanBoardMemberRead] = []
    for member in members:
        user = users.get(member.user_id)
        if user is None:
            continue
        result.append(
            KanbanBoardMemberRead(
                user_id=member.user_id,
                display_name=user.display_name,
                role=member.role,  # type: ignore[arg-type]
            )
        )
    result.sort(key=lambda m: m.display_name.lower())
    return result


def _board_summary(
    board: KanbanBoard,
    *,
    team_name: str | None,
    my_role: str | None,
) -> KanbanBoardSummaryRead:
    return KanbanBoardSummaryRead(
        id=board.id,
        name=board.name,
        description=board.description,
        team_id=board.team_id,
        team_name=team_name,
        created_by_user_id=board.created_by_user_id,
        created_at=board.created_at,
        updated_at=board.updated_at,
        my_role=my_role,  # type: ignore[arg-type]
    )


async def _require_edit_access(
    db: AsyncSession,
    board: KanbanBoard,
    user: User,
) -> str | None:
    roles, _ = await _require_board_access(db, board, user)
    my_role = resolve_member_role(board, user, roles)
    if not user_can_edit_board(my_role, user, board):
        raise PermissionError("board_forbidden")
    return my_role


def _ticket_in_board_scope(board: KanbanBoard, ticket: Ticket) -> bool:
    if board.team_id is None:
        return True
    return ticket.assigned_team_id == board.team_id


async def _next_card_position(
    db: AsyncSession,
    board_id: uuid.UUID,
    column_id: uuid.UUID,
) -> int:
    result = await db.execute(
        select(func.coalesce(func.max(KanbanBoardTicket.position), -1)).where(
            KanbanBoardTicket.board_id == board_id,
            KanbanBoardTicket.column_id == column_id,
        )
    )
    return int(result.scalar_one()) + 1


async def _create_ticket_for_board(
    db: AsyncSession,
    user: User,
    payload: TicketCreate,
    *,
    board: KanbanBoard,
) -> Ticket:
    routing = await apply_routing(
        db,
        ticket_type=payload.ticket_type,
        category_id=payload.category_id,
        subcategory_id=payload.subcategory_id,
        priority=payload.priority,
    )
    now = datetime.now(UTC)
    assigned_team_id = routing.assigned_team_id
    if board.team_id is not None and assigned_team_id is None:
        assigned_team_id = board.team_id

    resolved_source = resolve_ticket_source_on_create(
        is_staff_user=is_staff(user),
        requested=payload.source,
    )
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number=await generate_ticket_number(db, payload.ticket_type),
        ticket_type=payload.ticket_type,
        title=payload.title,
        description=payload.description,
        status="assigned" if assigned_team_id else "new",
        priority=routing.priority,
        reporter_user_id=user.id,
        organization_id=get_user_organization_id(user),
        assigned_team_id=assigned_team_id,
        assigned_user_id=routing.assigned_user_id,
        category_id=payload.category_id,
        subcategory_id=payload.subcategory_id,
        source=resolved_source,
        escalation_level=0,
        gdpr_consent=payload.gdpr_consent,
        gdpr_consent_at=now if payload.gdpr_consent else None,
        subject_cpr=payload.subject_cpr,
        is_major=payload.is_major,
        is_security_ticket=False,
        parent_ticket_id=None,
        tags=payload.tags,
        emoji=payload.emoji,
        routing_metadata={},
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    db.add(ticket)
    await apply_sla_to_ticket(db, ticket, priority=routing.priority, start_at=now)
    await db.flush()
    if ticket.status == "assigned":
        maybe_set_assigned_at(ticket, now=now)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=user.id,
            event_type="ticket.created",
            payload={"ticket_number": ticket.ticket_number, "source": "kanban"},
            created_at=now,
        )
    )
    return ticket


async def list_boards(db: AsyncSession, user: User) -> list[KanbanBoardSummaryRead]:
    stmt = (
        select(KanbanBoard).where(KanbanBoard.deleted_at.is_(None)).order_by(KanbanBoard.name.asc())
    )
    if not sees_all_boards(user):
        member_board_ids = list(
            (
                await db.execute(
                    select(KanbanBoardMember.board_id).where(KanbanBoardMember.user_id == user.id)
                )
            )
            .scalars()
            .all()
        )
        visibility = [KanbanBoard.created_by_user_id == user.id]
        if member_board_ids:
            visibility.append(KanbanBoard.id.in_(member_board_ids))
        stmt = stmt.where(or_(*visibility))

    boards = (await db.execute(stmt)).scalars().all()
    board_ids = [b.id for b in boards]
    role_by_board, _ = await _load_member_maps(db, board_ids)
    team_names = await _team_names(db, {b.team_id for b in boards if b.team_id})

    summaries: list[KanbanBoardSummaryRead] = []
    for board in boards:
        roles = role_by_board.get(board.id, {})
        my_role = resolve_member_role(board, user, roles)
        summaries.append(
            _board_summary(
                board,
                team_name=team_names.get(board.team_id) if board.team_id else None,
                my_role=my_role,
            )
        )
    return summaries


async def get_board_row(db: AsyncSession, board_id: uuid.UUID) -> KanbanBoard | None:
    board = await db.get(KanbanBoard, board_id)
    if board is None or board.deleted_at is not None:
        return None
    return board


async def _require_board_access(
    db: AsyncSession,
    board: KanbanBoard,
    user: User,
) -> tuple[dict[uuid.UUID, str], list[KanbanBoardMember]]:
    role_by_board, members_by_board = await _load_member_maps(db, [board.id])
    roles = role_by_board.get(board.id, {})
    member_ids = set(roles.keys())
    if not user_can_view_board(board, user, member_ids):
        raise PermissionError("board_forbidden")
    return roles, members_by_board.get(board.id, [])


async def create_board(
    db: AsyncSession,
    user: User,
    payload: KanbanBoardCreate,
) -> KanbanBoardSummaryRead:
    now = datetime.now(UTC)
    board_id = uuid.uuid4()
    board = KanbanBoard(
        id=board_id,
        name=payload.name.strip(),
        description=payload.description,
        team_id=payload.team_id,
        created_by_user_id=user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(board)
    db.add(
        KanbanBoardMember(
            board_id=board_id,
            user_id=user.id,
            role=KANBAN_ROLE_OWNER,
            created_at=now,
        )
    )
    for column in build_columns_for_board(
        board_id,
        template=payload.template,
        column_names=payload.column_names,
        now=now,
    ):
        db.add(column)
    for member_id in payload.member_user_ids:
        if member_id == user.id:
            continue
        db.add(
            KanbanBoardMember(
                board_id=board_id,
                user_id=member_id,
                role="editor",
                created_at=now,
            )
        )
    await db.commit()
    await db.refresh(board)
    team_name = None
    if board.team_id:
        team = await db.get(Team, board.team_id)
        team_name = team.name if team else None
    return _board_summary(board, team_name=team_name, my_role=KANBAN_ROLE_OWNER)


async def update_board(
    db: AsyncSession,
    user: User,
    board_id: uuid.UUID,
    payload: KanbanBoardUpdate,
) -> KanbanBoardSummaryRead:
    board = await get_board_row(db, board_id)
    if board is None:
        raise LookupError("board_not_found")
    roles, members = await _require_board_access(db, board, user)
    my_role = resolve_member_role(board, user, roles)
    if not user_can_edit_board(my_role, user, board):
        raise PermissionError("board_forbidden")

    now = datetime.now(UTC)
    if payload.name is not None:
        board.name = payload.name.strip()
    if payload.description is not None:
        board.description = payload.description
    if "team_id" in payload.model_fields_set:
        board.team_id = payload.team_id
    board.updated_at = now

    if payload.members is not None:
        await _sync_members(db, board_id, payload.members, now=now)

    await db.commit()
    await db.refresh(board)
    role_by_board, _ = await _load_member_maps(db, [board.id])
    roles = role_by_board.get(board.id, {})
    my_role = resolve_member_role(board, user, roles)
    team_name = None
    if board.team_id:
        team = await db.get(Team, board.team_id)
        team_name = team.name if team else None
    return _board_summary(board, team_name=team_name, my_role=my_role)


async def delete_board(
    db: AsyncSession,
    user: User,
    board_id: uuid.UUID,
) -> None:
    board = await get_board_row(db, board_id)
    if board is None:
        raise LookupError("board_not_found")
    roles, _ = await _require_board_access(db, board, user)
    my_role = resolve_member_role(board, user, roles)
    if not user_can_delete_board(my_role, user, board):
        raise PermissionError("board_forbidden")
    board.deleted_at = datetime.now(UTC)
    board.updated_at = datetime.now(UTC)
    await db.commit()


async def _sync_members(
    db: AsyncSession,
    board_id: uuid.UUID,
    members: list[KanbanBoardMemberWrite],
    *,
    now: datetime,
) -> None:
    board = await db.get(KanbanBoard, board_id)
    creator_id = board.created_by_user_id if board else None
    await db.execute(
        KanbanBoardMember.__table__.delete().where(  # type: ignore[attr-defined]
            KanbanBoardMember.board_id == board_id
        )
    )
    seen: set[uuid.UUID] = set()
    if creator_id is not None:
        seen.add(creator_id)
        db.add(
            KanbanBoardMember(
                board_id=board_id,
                user_id=creator_id,
                role=KANBAN_ROLE_OWNER,
                created_at=now,
            )
        )
    for entry in members:
        if entry.user_id in seen:
            continue
        seen.add(entry.user_id)
        role = KANBAN_ROLE_OWNER if entry.user_id == creator_id else entry.role
        db.add(
            KanbanBoardMember(
                board_id=board_id,
                user_id=entry.user_id,
                role=role,
                created_at=now,
            )
        )


async def get_board_detail(
    db: AsyncSession,
    user: User,
    board_id: uuid.UUID,
) -> KanbanBoardDetailRead:
    board = await get_board_row(db, board_id)
    if board is None:
        raise LookupError("board_not_found")
    roles, members = await _require_board_access(db, board, user)
    my_role = resolve_member_role(board, user, roles)

    columns = await _list_board_columns(db, board_id)

    placements = (
        (
            await db.execute(
                select(KanbanBoardTicket)
                .where(KanbanBoardTicket.board_id == board_id)
                .order_by(KanbanBoardTicket.column_id.asc(), KanbanBoardTicket.position.asc())
            )
        )
        .scalars()
        .all()
    )

    ticket_ids = [p.ticket_id for p in placements]
    tickets: list[Ticket] = []
    if ticket_ids:
        stmt = select(Ticket).where(
            Ticket.id.in_(ticket_ids),
            Ticket.deleted_at.is_(None),
        )
        stmt = exclude_knowledge_articles(stmt)
        stmt = apply_ticket_list_filter(stmt, user)
        tickets = list((await db.execute(stmt)).scalars().all())

    ticket_reads = await tickets_to_read_list(db, tickets)
    reads_by_id = {r.id: r for r in ticket_reads}

    column_cards: dict[uuid.UUID, list[KanbanCardRead]] = {c.id: [] for c in columns}
    for placement in placements:
        read = reads_by_id.get(placement.ticket_id)
        if read is None:
            continue
        column_cards.setdefault(placement.column_id, []).append(
            KanbanCardRead(ticket=read, position=placement.position)
        )

    team_name = None
    if board.team_id:
        team = await db.get(Team, board.team_id)
        team_name = team.name if team else None

    member_reads = await _member_reads(db, members)
    can_edit = user_can_edit_board(my_role, user, board)
    can_move = user_can_move_cards(my_role, user)
    can_remove = user_can_remove_cards(my_role, user)
    can_delete = user_can_delete_board(my_role, user, board)
    can_delete_tickets = user_can_delete_tickets(user)

    return KanbanBoardDetailRead(
        board=_board_summary(board, team_name=team_name, my_role=my_role),
        columns=[
            KanbanColumnWithCardsRead(
                column=KanbanColumnRead.model_validate(col),
                cards=column_cards.get(col.id, []),
            )
            for col in columns
        ],
        members=member_reads,
        can_edit=can_edit,
        can_move_cards=can_move,
        can_remove_cards=can_remove,
        can_delete_board=can_delete,
        can_delete_tickets=can_delete_tickets,
    )


async def add_card(
    db: AsyncSession,
    user: User,
    board_id: uuid.UUID,
    payload: KanbanCardAdd,
) -> TicketRead:
    board = await get_board_row(db, board_id)
    if board is None:
        raise LookupError("board_not_found")
    await _require_edit_access(db, board, user)

    column = await db.get(KanbanColumn, payload.column_id)
    if column is None or column.board_id != board_id:
        raise LookupError("column_not_found")

    now = datetime.now(UTC)
    if payload.ticket is not None:
        ticket = await _create_ticket_for_board(db, user, payload.ticket, board=board)
    else:
        assert payload.ticket_id is not None
        ticket = await db.get(Ticket, payload.ticket_id)
        if ticket is None or ticket.deleted_at is not None:
            raise LookupError("ticket_not_found")
        stmt = select(Ticket).where(Ticket.id == ticket.id)
        stmt = exclude_knowledge_articles(stmt)
        stmt = apply_ticket_list_filter(stmt, user)
        visible = (await db.execute(stmt)).scalar_one_or_none()
        if visible is None:
            raise PermissionError("ticket_forbidden")
        if not _ticket_in_board_scope(board, ticket):
            raise PermissionError("ticket_out_of_scope")
        existing = (
            await db.execute(
                select(KanbanBoardTicket).where(
                    KanbanBoardTicket.board_id == board_id,
                    KanbanBoardTicket.ticket_id == payload.ticket_id,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise ValueError("ticket_already_on_board")

    position = await _next_card_position(db, board_id, payload.column_id)
    db.add(
        KanbanBoardTicket(
            board_id=board_id,
            ticket_id=ticket.id,
            column_id=payload.column_id,
            position=position,
            created_at=now,
        )
    )
    await db.commit()
    reads = await tickets_to_read_list(db, [ticket])
    return reads[0]


async def remove_card(
    db: AsyncSession,
    user: User,
    board_id: uuid.UUID,
    ticket_id: uuid.UUID,
    *,
    delete_ticket: bool = False,
) -> None:
    board = await get_board_row(db, board_id)
    if board is None:
        raise LookupError("board_not_found")
    roles, _ = await _require_board_access(db, board, user)
    my_role = resolve_member_role(board, user, roles)

    if delete_ticket:
        if not user_can_delete_tickets(user):
            raise PermissionError("board_forbidden")
    elif not user_can_remove_cards(my_role, user):
        raise PermissionError("board_forbidden")

    placement = (
        await db.execute(
            select(KanbanBoardTicket).where(
                KanbanBoardTicket.board_id == board_id,
                KanbanBoardTicket.ticket_id == ticket_id,
            )
        )
    ).scalar_one_or_none()
    if placement is None:
        raise LookupError("card_not_found")

    await db.execute(
        delete(KanbanBoardTicket).where(
            KanbanBoardTicket.board_id == board_id,
            KanbanBoardTicket.ticket_id == ticket_id,
        )
    )

    if delete_ticket:
        ticket = await db.get(Ticket, ticket_id)
        if ticket is not None and ticket.deleted_at is None:
            now = datetime.now(UTC)
            ticket.deleted_at = now
            ticket.updated_at = now

    await db.commit()


async def move_card(
    db: AsyncSession,
    user: User,
    board_id: uuid.UUID,
    ticket_id: uuid.UUID,
    column_id: uuid.UUID,
    position: int | None = None,
) -> TicketRead:
    board = await get_board_row(db, board_id)
    if board is None:
        raise LookupError("board_not_found")
    roles, _ = await _require_board_access(db, board, user)
    my_role = resolve_member_role(board, user, roles)
    if not user_can_move_cards(my_role, user):
        raise PermissionError("board_forbidden")

    column = await db.get(KanbanColumn, column_id)
    if column is None or column.board_id != board_id:
        raise LookupError("column_not_found")

    placement = (
        await db.execute(
            select(KanbanBoardTicket).where(
                KanbanBoardTicket.board_id == board_id,
                KanbanBoardTicket.ticket_id == ticket_id,
            )
        )
    ).scalar_one_or_none()
    if placement is None:
        raise LookupError("card_not_found")

    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise LookupError("ticket_not_found")

    now = datetime.now(UTC)
    new_position = (
        position if position is not None else await _next_card_position(db, board_id, column_id)
    )
    placement.column_id = column_id
    placement.position = new_position

    if column.default_status:
        previous_status = ticket.status
        ticket.status = column.default_status
        apply_status_milestone_timestamps(ticket, column.default_status, now=now)
        ticket.updated_at = now

        event_type = "ticket.status_changed"
        if is_reopen_transition(previous_status, column.default_status):
            event_type = "ticket.reopened"

        db.add(
            TicketEvent(
                id=uuid.uuid4(),
                ticket_id=ticket.id,
                actor_user_id=user.id,
                event_type=event_type,
                payload={
                    "status": column.default_status,
                    "previous_status": previous_status,
                    "kanban_board_id": str(board_id),
                    "kanban_column_id": str(column_id),
                },
                created_at=now,
            )
        )

    await db.commit()
    await db.refresh(ticket)
    reads = await tickets_to_read_list(db, [ticket])
    return reads[0]


async def create_column(
    db: AsyncSession,
    user: User,
    board_id: uuid.UUID,
    payload: KanbanColumnCreate,
) -> KanbanColumnRead:
    board = await get_board_row(db, board_id)
    if board is None:
        raise LookupError("board_not_found")
    await _require_edit_access(db, board, user)

    columns = await _list_board_columns(db, board_id)

    position = payload.position
    if position is None:
        position = len(columns)

    now = datetime.now(UTC)
    column = KanbanColumn(
        id=uuid.uuid4(),
        board_id=board_id,
        name=payload.name.strip(),
        position=position,
        statuses=[],
        default_status=payload.default_status,
        is_custom=True,
        wip_limit=payload.wip_limit,
        created_at=now,
        updated_at=now,
    )
    db.add(column)

    for col in columns:
        if col.position >= position:
            col.position += 1
            col.updated_at = now

    await db.commit()
    await db.refresh(column)
    return KanbanColumnRead.model_validate(column)


async def _reposition_kanban_column(
    db: AsyncSession,
    board_id: uuid.UUID,
    column: KanbanColumn,
    new_pos: int,
    now: datetime,
) -> None:
    columns = await _list_board_columns(db, board_id)
    old_pos = column.position
    for col in columns:
        if col.id == column.id:
            continue
        if old_pos < new_pos and old_pos < col.position <= new_pos:
            col.position -= 1
        elif old_pos > new_pos and new_pos <= col.position < old_pos:
            col.position += 1
        col.updated_at = now
    column.position = new_pos


async def update_column(
    db: AsyncSession,
    user: User,
    board_id: uuid.UUID,
    column_id: uuid.UUID,
    payload: KanbanColumnUpdate,
) -> KanbanColumnRead:
    board = await get_board_row(db, board_id)
    if board is None:
        raise LookupError("board_not_found")
    await _require_edit_access(db, board, user)

    column = await db.get(KanbanColumn, column_id)
    if column is None or column.board_id != board_id:
        raise LookupError("column_not_found")

    now = datetime.now(UTC)
    if payload.name is not None:
        column.name = payload.name.strip()
    if payload.wip_limit is not None or "wip_limit" in payload.model_fields_set:
        column.wip_limit = payload.wip_limit
    if payload.default_status is not None or "default_status" in payload.model_fields_set:
        column.default_status = payload.default_status

    if payload.position is not None and payload.position != column.position:
        await _reposition_kanban_column(db, board_id, column, payload.position, now)

    column.updated_at = now
    await db.commit()
    await db.refresh(column)
    return KanbanColumnRead.model_validate(column)


async def delete_column(
    db: AsyncSession,
    user: User,
    board_id: uuid.UUID,
    column_id: uuid.UUID,
) -> None:
    board = await get_board_row(db, board_id)
    if board is None:
        raise LookupError("board_not_found")
    await _require_edit_access(db, board, user)

    column = await db.get(KanbanColumn, column_id)
    if column is None or column.board_id != board_id:
        raise LookupError("column_not_found")

    card_count = (
        await db.execute(
            select(func.count())
            .select_from(KanbanBoardTicket)
            .where(
                KanbanBoardTicket.board_id == board_id,
                KanbanBoardTicket.column_id == column_id,
            )
        )
    ).scalar_one()
    if card_count > 0:
        raise ValueError("column_not_empty")

    now = datetime.now(UTC)
    removed_pos = column.position
    await db.delete(column)

    remaining = (
        (
            await db.execute(
                select(KanbanColumn)
                .where(KanbanColumn.board_id == board_id, KanbanColumn.position > removed_pos)
                .order_by(KanbanColumn.position.asc())
            )
        )
        .scalars()
        .all()
    )
    for col in remaining:
        col.position -= 1
        col.updated_at = now

    await db.commit()


async def search_tickets_for_board(
    db: AsyncSession,
    user: User,
    board_id: uuid.UUID,
    query: str,
    *,
    limit: int = 20,
) -> list[KanbanTicketSearchResult]:
    board = await get_board_row(db, board_id)
    if board is None:
        raise LookupError("board_not_found")
    await _require_board_access(db, board, user)

    q = query.strip()
    if len(q) < 2:
        return []

    on_board = set(
        (
            await db.execute(
                select(KanbanBoardTicket.ticket_id).where(KanbanBoardTicket.board_id == board_id)
            )
        )
        .scalars()
        .all()
    )

    stmt = select(Ticket).where(Ticket.deleted_at.is_(None))
    stmt = exclude_knowledge_articles(stmt)
    stmt = apply_ticket_list_filter(stmt, user)
    if board.team_id is not None:
        stmt = stmt.where(Ticket.assigned_team_id == board.team_id)
    if on_board:
        stmt = stmt.where(Ticket.id.notin_(on_board))

    pattern = f"%{q}%"
    stmt = (
        stmt.where(
            or_(
                Ticket.title.ilike(pattern),
                Ticket.ticket_number.ilike(pattern),
            )
        )
        .order_by(Ticket.updated_at.desc())
        .limit(limit)
    )

    tickets = (await db.execute(stmt)).scalars().all()
    reads = await tickets_to_read_list(db, tickets)
    return [
        KanbanTicketSearchResult(
            id=r.id,
            ticket_number=r.ticket_number,
            title=r.title,
            status=r.status,
            priority=r.priority,
            assigned_team_name=r.assigned_team_name,
            assigned_user_name=r.assigned_user_name,
        )
        for r in reads
    ]
