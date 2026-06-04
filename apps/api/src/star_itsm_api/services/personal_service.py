"""Personal workspace: notes and private kanban for each user."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.personal import (
    DEFAULT_KANBAN_COLUMNS,
    PersonalKanbanCard,
    PersonalNote,
)
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.schemas.personal import (
    PersonalKanbanCardRead,
    PersonalKanbanColumnUpdate,
    PersonalKanbanRead,
    PersonalNoteCreate,
    PersonalNoteRead,
    PersonalNoteUpdate,
)
from star_itsm_api.schemas.ticket import TicketRead
from star_itsm_api.services.ticket_read import tickets_to_read_list


def _now() -> datetime:
    return datetime.now(UTC)


def _note_to_read(row: PersonalNote) -> PersonalNoteRead:
    return PersonalNoteRead(
        id=row.id,
        user_id=row.user_id,
        title=row.title,
        content=row.content,
        is_pinned=row.is_pinned,
        sort_order=row.sort_order,
        color=row.color,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def list_notes(db: AsyncSession, user: User) -> list[PersonalNoteRead]:
    result = await db.execute(
        select(PersonalNote)
        .where(
            PersonalNote.user_id == user.id,
            PersonalNote.deleted_at.is_(None),
        )
        .order_by(
            PersonalNote.is_pinned.desc(),
            PersonalNote.sort_order.asc(),
            PersonalNote.updated_at.desc(),
        )
    )
    return [_note_to_read(row) for row in result.scalars().all()]


async def create_note(
    db: AsyncSession,
    user: User,
    payload: PersonalNoteCreate,
) -> PersonalNoteRead:
    now = _now()
    max_order_result = await db.execute(
        select(PersonalNote.sort_order)
        .where(
            PersonalNote.user_id == user.id,
            PersonalNote.deleted_at.is_(None),
        )
        .order_by(PersonalNote.sort_order.desc())
        .limit(1)
    )
    max_order = max_order_result.scalar_one_or_none() or -1
    row = PersonalNote(
        id=uuid.uuid4(),
        user_id=user.id,
        title=payload.title.strip(),
        content=payload.content.strip(),
        is_pinned=payload.is_pinned,
        sort_order=max_order + 1,
        color=payload.color,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _note_to_read(row)


async def update_note(
    db: AsyncSession,
    user: User,
    note_id: uuid.UUID,
    payload: PersonalNoteUpdate,
) -> PersonalNoteRead:
    row = await db.get(PersonalNote, note_id)
    if row is None or row.deleted_at is not None or row.user_id != user.id:
        raise LookupError("note_not_found")
    if payload.title is not None:
        row.title = payload.title.strip()
    if payload.content is not None:
        row.content = payload.content.strip()
    if payload.is_pinned is not None:
        row.is_pinned = payload.is_pinned
    if payload.sort_order is not None:
        row.sort_order = payload.sort_order
    if payload.color is not None:
        row.color = payload.color or None
    row.updated_at = _now()
    await db.commit()
    await db.refresh(row)
    return _note_to_read(row)


async def delete_note(db: AsyncSession, user: User, note_id: uuid.UUID) -> None:
    row = await db.get(PersonalNote, note_id)
    if row is None or row.deleted_at is not None or row.user_id != user.id:
        raise LookupError("note_not_found")
    row.deleted_at = _now()
    row.updated_at = _now()
    await db.commit()


async def get_personal_kanban(db: AsyncSession, user: User) -> PersonalKanbanRead:
    result = await db.execute(
        select(PersonalKanbanCard)
        .where(PersonalKanbanCard.user_id == user.id)
        .order_by(PersonalKanbanCard.column_name.asc(), PersonalKanbanCard.sort_order.asc())
    )
    cards = list(result.scalars().all())
    ticket_ids = [card.ticket_id for card in cards]
    tickets: list[TicketRead] = []
    if ticket_ids:
        ticket_rows = await db.execute(
            select(Ticket).where(
                Ticket.id.in_(ticket_ids),
                Ticket.deleted_at.is_(None),
            )
        )
        ticket_map = {t.id: t for t in ticket_rows.scalars().all()}
        ordered = [ticket_map[tid] for tid in ticket_ids if tid in ticket_map]
        tickets = await tickets_to_read_list(db, ordered)
    return PersonalKanbanRead(
        columns=list(DEFAULT_KANBAN_COLUMNS),
        cards=[
            PersonalKanbanCardRead(
                user_id=card.user_id,
                ticket_id=card.ticket_id,
                column_name=card.column_name,
                sort_order=card.sort_order,
                created_at=card.created_at,
            )
            for card in cards
        ],
        tickets=tickets,
    )


async def _next_kanban_sort_order(
    db: AsyncSession,
    user_id: uuid.UUID,
    column_name: str,
) -> int:
    result = await db.execute(
        select(PersonalKanbanCard.sort_order)
        .where(
            PersonalKanbanCard.user_id == user_id,
            PersonalKanbanCard.column_name == column_name,
        )
        .order_by(PersonalKanbanCard.sort_order.desc())
        .limit(1)
    )
    max_order = result.scalar_one_or_none()
    return (max_order or -1) + 1


async def add_kanban_card(
    db: AsyncSession,
    user: User,
    ticket_id: uuid.UUID,
    *,
    column_name: str | None = None,
) -> PersonalKanbanCardRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise LookupError("ticket_not_found")
    target_column = column_name or DEFAULT_KANBAN_COLUMNS[0]
    if target_column not in DEFAULT_KANBAN_COLUMNS:
        raise ValueError("invalid_column")
    existing = await db.get(PersonalKanbanCard, {"user_id": user.id, "ticket_id": ticket_id})
    if existing is not None:
        raise ValueError("ticket_already_on_board")
    row = PersonalKanbanCard(
        user_id=user.id,
        ticket_id=ticket_id,
        column_name=target_column,
        sort_order=await _next_kanban_sort_order(db, user.id, target_column),
        created_at=_now(),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return PersonalKanbanCardRead(
        user_id=row.user_id,
        ticket_id=row.ticket_id,
        column_name=row.column_name,
        sort_order=row.sort_order,
        created_at=row.created_at,
    )


async def move_kanban_card(
    db: AsyncSession,
    user: User,
    ticket_id: uuid.UUID,
    payload: PersonalKanbanColumnUpdate,
) -> PersonalKanbanCardRead:
    if payload.column_name not in DEFAULT_KANBAN_COLUMNS:
        raise ValueError("invalid_column")
    row = await db.get(PersonalKanbanCard, {"user_id": user.id, "ticket_id": ticket_id})
    if row is None:
        raise LookupError("card_not_found")
    row.column_name = payload.column_name
    row.sort_order = await _next_kanban_sort_order(db, user.id, payload.column_name)
    await db.commit()
    await db.refresh(row)
    return PersonalKanbanCardRead(
        user_id=row.user_id,
        ticket_id=row.ticket_id,
        column_name=row.column_name,
        sort_order=row.sort_order,
        created_at=row.created_at,
    )


async def remove_kanban_card(
    db: AsyncSession,
    user: User,
    ticket_id: uuid.UUID,
) -> None:
    row = await db.get(PersonalKanbanCard, {"user_id": user.id, "ticket_id": ticket_id})
    if row is None:
        raise LookupError("card_not_found")
    await db.delete(row)
    await db.commit()
