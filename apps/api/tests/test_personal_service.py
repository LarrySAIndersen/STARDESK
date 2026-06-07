"""Unit tests for personal_service (notes + private kanban)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.models.personal import DEFAULT_KANBAN_COLUMNS, PersonalKanbanCard, PersonalNote
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.schemas.personal import (
    PersonalKanbanColumnUpdate,
    PersonalNoteCreate,
    PersonalNoteUpdate,
)
from star_itsm_api.services import personal_service


def _user() -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4())


def _note(*, user_id: uuid.UUID, note_id: uuid.UUID | None = None) -> PersonalNote:
    now = datetime.now(UTC)
    return PersonalNote(
        id=note_id or uuid.uuid4(),
        user_id=user_id,
        title="Note",
        content="Body",
        is_pinned=False,
        sort_order=0,
        color=None,
        category=None,
        ticket_id=None,
        visibility="private",
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )


@pytest.mark.asyncio
async def test_list_notes_returns_active_notes_for_user() -> None:
    user = _user()
    note = _note(user_id=user.id)
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [note]
    mock_db.execute = AsyncMock(return_value=mock_result)

    rows = await personal_service.list_notes(mock_db, user)
    assert len(rows) == 1
    assert rows[0].title == "Note"
    assert rows[0].user_id == user.id


@pytest.mark.asyncio
async def test_create_note_assigns_next_sort_order() -> None:
    user = _user()
    mock_db = AsyncMock()
    order_result = MagicMock()
    order_result.scalar_one_or_none.return_value = 2
    mock_db.execute = AsyncMock(return_value=order_result)

    mock_db.refresh = AsyncMock()

    read = await personal_service.create_note(
        mock_db,
        user,
        PersonalNoteCreate(title="  Ny note  ", content="  Indhold  ", is_pinned=True, color="blue"),
    )

    assert read.title == "Ny note"
    assert read.content == "Indhold"
    assert read.sort_order == 3
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_note_success() -> None:
    user = _user()
    note = _note(user_id=user.id)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=note)

    read = await personal_service.update_note(
        mock_db,
        user,
        note.id,
        PersonalNoteUpdate(title=" Opdateret ", content=" Nyt ", is_pinned=True, sort_order=5, color=""),
    )
    assert read.title == "Opdateret"
    assert note.is_pinned is True
    assert note.color is None
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_note_not_found() -> None:
    user = _user()
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)
    with pytest.raises(LookupError, match="note_not_found"):
        await personal_service.update_note(
            mock_db,
            user,
            uuid.uuid4(),
            PersonalNoteUpdate(title="X"),
        )


@pytest.mark.asyncio
async def test_delete_note_success() -> None:
    user = _user()
    note = _note(user_id=user.id)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=note)

    await personal_service.delete_note(mock_db, user, note.id)
    assert note.deleted_at is not None
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_note_wrong_owner() -> None:
    user = _user()
    note = _note(user_id=uuid.uuid4())
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=note)
    with pytest.raises(LookupError, match="note_not_found"):
        await personal_service.delete_note(mock_db, user, note.id)


@pytest.mark.asyncio
async def test_get_personal_kanban_empty() -> None:
    user = _user()
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)

    board = await personal_service.get_personal_kanban(mock_db, user)
    assert board.columns == list(DEFAULT_KANBAN_COLUMNS)
    assert board.cards == []
    assert board.tickets == []


@pytest.mark.asyncio
async def test_get_personal_kanban_with_tickets() -> None:
    user = _user()
    ticket_id = uuid.uuid4()
    card = PersonalKanbanCard(
        user_id=user.id,
        ticket_id=ticket_id,
        column_name=DEFAULT_KANBAN_COLUMNS[0],
        sort_order=0,
        created_at=datetime.now(UTC),
    )
    ticket = Ticket(
        id=ticket_id,
        ticket_number="INC-1",
        ticket_type="incident",
        title="Sag",
        description="Beskrivelse lang nok til test",
        status="new",
        priority="medium",
        reporter_user_id=uuid.uuid4(),
        source="portal",
        created_at=datetime.now(UTC),
    )

    cards_result = MagicMock()
    cards_result.scalars.return_value.all.return_value = [card]
    tickets_result = MagicMock()
    tickets_result.scalars.return_value.all.return_value = [ticket]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[cards_result, tickets_result])

    with patch(
        "star_itsm_api.services.personal_service.tickets_to_read_list",
        new_callable=AsyncMock,
        return_value=[],
    ) as mock_read:
        board = await personal_service.get_personal_kanban(mock_db, user)

    assert len(board.cards) == 1
    assert board.cards[0].ticket_id == ticket_id
    assert board.tickets == []
    mock_read.assert_awaited_once()


@pytest.mark.asyncio
async def test_add_kanban_card_success() -> None:
    user = _user()
    ticket_id = uuid.uuid4()
    ticket = Ticket(
        id=ticket_id,
        ticket_number="INC-2",
        ticket_type="incident",
        title="Sag",
        description="Beskrivelse lang nok til test",
        status="new",
        priority="medium",
        reporter_user_id=uuid.uuid4(),
        source="portal",
        created_at=datetime.now(UTC),
    )
    row = PersonalKanbanCard(
        user_id=user.id,
        ticket_id=ticket_id,
        column_name=DEFAULT_KANBAN_COLUMNS[1],
        sort_order=0,
        created_at=datetime.now(UTC),
    )
    mock_db = AsyncMock()

    def _get(model, pk):  # noqa: ANN001
        if model is Ticket:
            return ticket
        return None

    mock_db.get = AsyncMock(side_effect=_get)
    with patch.object(
        personal_service,
        "_next_kanban_sort_order",
        new_callable=AsyncMock,
        return_value=0,
    ), patch.object(personal_service, "PersonalKanbanCard", return_value=row):
        read = await personal_service.add_kanban_card(
            mock_db,
            user,
            ticket_id,
            column_name=DEFAULT_KANBAN_COLUMNS[1],
        )

    assert read.column_name == DEFAULT_KANBAN_COLUMNS[1]
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_add_kanban_card_ticket_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)
    with pytest.raises(LookupError, match="ticket_not_found"):
        await personal_service.add_kanban_card(mock_db, _user(), uuid.uuid4())


@pytest.mark.asyncio
async def test_add_kanban_card_invalid_column() -> None:
    ticket = MagicMock(deleted_at=None)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=ticket)
    with pytest.raises(ValueError, match="invalid_column"):
        await personal_service.add_kanban_card(
            mock_db,
            _user(),
            uuid.uuid4(),
            column_name="Ukendt kolonne",
        )


@pytest.mark.asyncio
async def test_add_kanban_card_already_on_board() -> None:
    user = _user()
    ticket_id = uuid.uuid4()
    ticket = MagicMock(deleted_at=None)
    existing = MagicMock()
    mock_db = AsyncMock()

    def _get(model, pk):  # noqa: ANN001
        if model is Ticket:
            return ticket
        if isinstance(pk, dict):
            return existing
        return None

    mock_db.get = AsyncMock(side_effect=_get)
    with pytest.raises(ValueError, match="ticket_already_on_board"):
        await personal_service.add_kanban_card(mock_db, user, ticket_id)


@pytest.mark.asyncio
async def test_move_kanban_card_success() -> None:
    user = _user()
    ticket_id = uuid.uuid4()
    row = PersonalKanbanCard(
        user_id=user.id,
        ticket_id=ticket_id,
        column_name=DEFAULT_KANBAN_COLUMNS[0],
        sort_order=0,
        created_at=datetime.now(UTC),
    )
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=row)
    with patch.object(
        personal_service,
        "_next_kanban_sort_order",
        new_callable=AsyncMock,
        return_value=1,
    ):
        read = await personal_service.move_kanban_card(
            mock_db,
            user,
            ticket_id,
            PersonalKanbanColumnUpdate(column_name=DEFAULT_KANBAN_COLUMNS[2]),
        )
    assert read.column_name == DEFAULT_KANBAN_COLUMNS[2]
    assert row.sort_order == 1


@pytest.mark.asyncio
async def test_move_kanban_card_invalid_column() -> None:
    with pytest.raises(ValueError, match="invalid_column"):
        await personal_service.move_kanban_card(
            AsyncMock(),
            _user(),
            uuid.uuid4(),
            PersonalKanbanColumnUpdate(column_name="Ukendt"),
        )


@pytest.mark.asyncio
async def test_update_note_only_pinned() -> None:
    user = _user()
    note = _note(user_id=user.id)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=note)

    read = await personal_service.update_note(
        mock_db,
        user,
        note.id,
        PersonalNoteUpdate(is_pinned=True),
    )
    assert read.is_pinned is True
    assert note.title == "Note"


@pytest.mark.asyncio
async def test_add_kanban_card_uses_default_column_and_sort_order() -> None:
    user = _user()
    ticket_id = uuid.uuid4()
    ticket = Ticket(
        id=ticket_id,
        ticket_number="INC-3",
        ticket_type="incident",
        title="Sag",
        description="Beskrivelse lang nok til test",
        status="new",
        priority="medium",
        reporter_user_id=uuid.uuid4(),
        source="portal",
        created_at=datetime.now(UTC),
    )
    mock_db = AsyncMock()

    def _get(model, pk):  # noqa: ANN001
        if model is Ticket:
            return ticket
        return None

    mock_db.get = AsyncMock(side_effect=_get)

    with patch.object(
        personal_service,
        "_next_kanban_sort_order",
        new_callable=AsyncMock,
        return_value=4,
    ):
        read = await personal_service.add_kanban_card(mock_db, user, ticket_id)

    assert read.column_name == DEFAULT_KANBAN_COLUMNS[0]
    assert read.sort_order == 4


@pytest.mark.asyncio
async def test_move_kanban_card_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)
    with pytest.raises(LookupError, match="card_not_found"):
        await personal_service.move_kanban_card(
            mock_db,
            _user(),
            uuid.uuid4(),
            PersonalKanbanColumnUpdate(column_name=DEFAULT_KANBAN_COLUMNS[0]),
        )


@pytest.mark.asyncio
async def test_update_note_rejects_deleted() -> None:
    user = _user()
    note = _note(user_id=user.id)
    note.deleted_at = datetime.now(UTC)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=note)
    with pytest.raises(LookupError, match="note_not_found"):
        await personal_service.update_note(
            mock_db,
            user,
            note.id,
            PersonalNoteUpdate(title="X"),
        )


@pytest.mark.asyncio
async def test_remove_kanban_card_success() -> None:
    user = _user()
    row = MagicMock()
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=row)
    await personal_service.remove_kanban_card(mock_db, user, uuid.uuid4())
    mock_db.delete.assert_awaited_once_with(row)
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_remove_kanban_card_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)
    with pytest.raises(LookupError, match="card_not_found"):
        await personal_service.remove_kanban_card(mock_db, _user(), uuid.uuid4())
