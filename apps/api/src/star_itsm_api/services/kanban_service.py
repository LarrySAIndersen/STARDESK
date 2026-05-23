"""Kanban board CRUD, card loading, and status moves."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.kanban import (
    KANBAN_ROLE_OWNER,
    KanbanBoard,
    KanbanBoardMember,
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
    KanbanCardRead,
    KanbanColumnRead,
    KanbanColumnWithCardsRead,
)
from star_itsm_api.schemas.ticket import TicketRead
from star_itsm_api.services.kanban_access import (
    resolve_member_role,
    sees_all_boards,
    user_can_edit_board,
    user_can_move_cards,
    user_can_view_board,
    user_created_board,
)
from star_itsm_api.services.kanban_defaults import (
    all_board_statuses,
    build_default_columns,
    column_for_ticket_status,
)
from star_itsm_api.services.knowledge_articles import exclude_knowledge_articles
from star_itsm_api.services.org_access import apply_ticket_list_filter
from star_itsm_api.services.reports import is_reopen_transition
from star_itsm_api.services.ticket_read import tickets_to_read_list
from star_itsm_api.services.ticket_timestamps import apply_status_milestone_timestamps


async def _load_member_maps(
    db: AsyncSession,
    board_ids: list[uuid.UUID],
) -> tuple[dict[uuid.UUID, dict[uuid.UUID, str]], dict[uuid.UUID, list[KanbanBoardMember]]]:
    if not board_ids:
        return {}, {}
    rows = (
        await db.execute(
            select(KanbanBoardMember).where(KanbanBoardMember.board_id.in_(board_ids))
        )
    ).scalars().all()
    role_by_board: dict[uuid.UUID, dict[uuid.UUID, str]] = {}
    members_by_board: dict[uuid.UUID, list[KanbanBoardMember]] = {}
    for member in rows:
        role_by_board.setdefault(member.board_id, {})[member.user_id] = member.role
        members_by_board.setdefault(member.board_id, []).append(member)
    return role_by_board, members_by_board


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


async def list_boards(db: AsyncSession, user: User) -> list[KanbanBoardSummaryRead]:
    stmt = select(KanbanBoard).where(KanbanBoard.deleted_at.is_(None)).order_by(
        KanbanBoard.name.asc()
    )
    if not sees_all_boards(user):
        member_board_ids = list(
            (
                await db.execute(
                    select(KanbanBoardMember.board_id).where(
                        KanbanBoardMember.user_id == user.id
                    )
                )
            ).scalars().all()
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
            _board_summary(board, team_name=team_names.get(board.team_id) if board.team_id else None, my_role=my_role)
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
    for column in build_default_columns(board_id, now=now):
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
    role_by_board, members_by_board = await _load_member_maps(db, [board.id])
    roles = role_by_board.get(board.id, {})
    my_role = resolve_member_role(board, user, roles)
    team_name = None
    if board.team_id:
        team = await db.get(Team, board.team_id)
        team_name = team.name if team else None
    return _board_summary(board, team_name=team_name, my_role=my_role)


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


def _sort_tickets_for_column(tickets: list[Ticket]) -> list[Ticket]:
    priority_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}

    def sort_key(ticket: Ticket) -> tuple[int, float]:
        return (
            priority_rank.get(ticket.priority, 9),
            -ticket.created_at.timestamp(),
        )

    return sorted(tickets, key=sort_key)


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

    columns = (
        await db.execute(
            select(KanbanColumn)
            .where(KanbanColumn.board_id == board_id)
            .order_by(KanbanColumn.position.asc())
        )
    ).scalars().all()
    allowed_statuses = all_board_statuses(columns)

    stmt = select(Ticket).where(Ticket.deleted_at.is_(None))
    stmt = exclude_knowledge_articles(stmt)
    stmt = apply_ticket_list_filter(stmt, user)
    if board.team_id is not None:
        stmt = stmt.where(Ticket.assigned_team_id == board.team_id)
    stmt = stmt.where(Ticket.status.in_(tuple(allowed_statuses)))

    tickets = (await db.execute(stmt)).scalars().all()
    ticket_reads = await tickets_to_read_list(db, tickets)

    tickets_by_id = {t.id: t for t in tickets}
    reads_by_id = {r.id: r for r in ticket_reads}

    column_cards: dict[uuid.UUID, list[KanbanCardRead]] = {c.id: [] for c in columns}
    for ticket in _sort_tickets_for_column(list(tickets_by_id.values())):
        column = column_for_ticket_status(columns, ticket.status)
        if column is None:
            continue
        read = reads_by_id.get(ticket.id)
        if read is None:
            continue
        cards = column_cards[column.id]
        column_cards[column.id].append(
            KanbanCardRead(ticket=read, position=len(cards))
        )

    team_name = None
    if board.team_id:
        team = await db.get(Team, board.team_id)
        team_name = team.name if team else None

    member_reads = await _member_reads(db, members)
    can_edit = user_can_edit_board(my_role, user, board)
    can_move = user_can_move_cards(my_role, user)

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
    )


async def move_card(
    db: AsyncSession,
    user: User,
    board_id: uuid.UUID,
    ticket_id: uuid.UUID,
    column_id: uuid.UUID,
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

    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise LookupError("ticket_not_found")

    if board.team_id is not None and ticket.assigned_team_id != board.team_id:
        raise PermissionError("ticket_out_of_scope")

    previous_status = ticket.status
    now = datetime.now(UTC)
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
