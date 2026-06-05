"""Unit tests for the thin kanban router layer (routers/kanban.py).

These tests call the endpoint coroutines directly with a mocked AsyncSession
and current user, patching ``kanban_service`` functions. The goal is to cover
each endpoint handler and its service-exception -> HTTPException translation.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from star_itsm_api.core.http_details import (
    BOARD_NOT_FOUND,
    COLUMN_NOT_FOUND,
    INSUFFICIENT_PERMISSIONS,
    NOT_FOUND,
    TICKET_NOT_FOUND,
)
from star_itsm_api.routers import kanban as kanban_router
from star_itsm_api.schemas.kanban import (
    KanbanBoardCreate,
    KanbanBoardUpdate,
    KanbanCardAdd,
    KanbanCardMove,
    KanbanColumnCreate,
    KanbanColumnUpdate,
)

pytestmark = pytest.mark.asyncio


@pytest.fixture
def db() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def user() -> MagicMock:
    return MagicMock()


def _patch(name: str, *, return_value: object = None, side_effect: object = None) -> object:
    return patch.object(
        kanban_router.kanban_service,
        name,
        new=AsyncMock(return_value=return_value, side_effect=side_effect),
    )


# --- list_boards ---------------------------------------------------------


async def test_list_boards_success(db: AsyncMock, user: MagicMock) -> None:
    sentinel = [object()]
    with _patch("list_boards", return_value=sentinel):
        result = await kanban_router.list_boards(db=db, current_user=user)
    assert result is sentinel


# --- create_board --------------------------------------------------------


async def test_create_board_success(db: AsyncMock, user: MagicMock) -> None:
    payload = KanbanBoardCreate(name="Mit board")
    sentinel = object()
    with _patch("create_board", return_value=sentinel):
        result = await kanban_router.create_board(payload=payload, db=db, current_user=user)
    assert result is sentinel


# --- get_board -----------------------------------------------------------


async def test_get_board_success(db: AsyncMock, user: MagicMock) -> None:
    sentinel = object()
    with _patch("get_board_detail", return_value=sentinel):
        result = await kanban_router.get_board(board_id=uuid.uuid4(), db=db, current_user=user)
    assert result is sentinel


async def test_get_board_not_found(db: AsyncMock, user: MagicMock) -> None:
    with _patch("get_board_detail", side_effect=LookupError()):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.get_board(board_id=uuid.uuid4(), db=db, current_user=user)
    assert exc.value.status_code == 404
    assert exc.value.detail == BOARD_NOT_FOUND


async def test_get_board_forbidden(db: AsyncMock, user: MagicMock) -> None:
    with _patch("get_board_detail", side_effect=PermissionError()):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.get_board(board_id=uuid.uuid4(), db=db, current_user=user)
    assert exc.value.status_code == 403
    assert exc.value.detail == INSUFFICIENT_PERMISSIONS


# --- update_board --------------------------------------------------------


async def test_update_board_success(db: AsyncMock, user: MagicMock) -> None:
    payload = KanbanBoardUpdate(name="Nyt navn")
    sentinel = object()
    with _patch("update_board", return_value=sentinel):
        result = await kanban_router.update_board(
            board_id=uuid.uuid4(), payload=payload, db=db, current_user=user
        )
    assert result is sentinel


async def test_update_board_not_found(db: AsyncMock, user: MagicMock) -> None:
    payload = KanbanBoardUpdate(name="Nyt navn")
    with _patch("update_board", side_effect=LookupError()):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.update_board(
                board_id=uuid.uuid4(), payload=payload, db=db, current_user=user
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == BOARD_NOT_FOUND


async def test_update_board_forbidden(db: AsyncMock, user: MagicMock) -> None:
    payload = KanbanBoardUpdate(name="Nyt navn")
    with _patch("update_board", side_effect=PermissionError()):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.update_board(
                board_id=uuid.uuid4(), payload=payload, db=db, current_user=user
            )
    assert exc.value.status_code == 403
    assert exc.value.detail == INSUFFICIENT_PERMISSIONS


# --- delete_board --------------------------------------------------------


async def test_delete_board_success(db: AsyncMock, user: MagicMock) -> None:
    with _patch("delete_board", return_value=None):
        result = await kanban_router.delete_board(board_id=uuid.uuid4(), db=db, current_user=user)
    assert result is None


async def test_delete_board_not_found(db: AsyncMock, user: MagicMock) -> None:
    with _patch("delete_board", side_effect=LookupError()):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.delete_board(board_id=uuid.uuid4(), db=db, current_user=user)
    assert exc.value.status_code == 404
    assert exc.value.detail == BOARD_NOT_FOUND


async def test_delete_board_forbidden(db: AsyncMock, user: MagicMock) -> None:
    with _patch("delete_board", side_effect=PermissionError()):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.delete_board(board_id=uuid.uuid4(), db=db, current_user=user)
    assert exc.value.status_code == 403
    assert exc.value.detail == INSUFFICIENT_PERMISSIONS


# --- add_card ------------------------------------------------------------


def _card_add() -> KanbanCardAdd:
    return KanbanCardAdd(column_id=uuid.uuid4(), ticket_id=uuid.uuid4())


async def test_add_card_success(db: AsyncMock, user: MagicMock) -> None:
    sentinel = object()
    with _patch("add_card", return_value=sentinel):
        result = await kanban_router.add_card(
            board_id=uuid.uuid4(), payload=_card_add(), db=db, current_user=user
        )
    assert result is sentinel


async def test_add_card_lookup_default(db: AsyncMock, user: MagicMock) -> None:
    with _patch("add_card", side_effect=LookupError("board_not_found")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.add_card(
                board_id=uuid.uuid4(), payload=_card_add(), db=db, current_user=user
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == NOT_FOUND


async def test_add_card_column_not_found(db: AsyncMock, user: MagicMock) -> None:
    with _patch("add_card", side_effect=LookupError("column_not_found")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.add_card(
                board_id=uuid.uuid4(), payload=_card_add(), db=db, current_user=user
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == COLUMN_NOT_FOUND


async def test_add_card_ticket_not_found(db: AsyncMock, user: MagicMock) -> None:
    with _patch("add_card", side_effect=LookupError("ticket_not_found")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.add_card(
                board_id=uuid.uuid4(), payload=_card_add(), db=db, current_user=user
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == TICKET_NOT_FOUND


async def test_add_card_ticket_out_of_scope(db: AsyncMock, user: MagicMock) -> None:
    with _patch("add_card", side_effect=PermissionError("ticket_out_of_scope")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.add_card(
                board_id=uuid.uuid4(), payload=_card_add(), db=db, current_user=user
            )
    assert exc.value.status_code == 400
    assert exc.value.detail == "Ticket is not in this board scope"


async def test_add_card_ticket_forbidden(db: AsyncMock, user: MagicMock) -> None:
    with _patch("add_card", side_effect=PermissionError("ticket_forbidden")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.add_card(
                board_id=uuid.uuid4(), payload=_card_add(), db=db, current_user=user
            )
    assert exc.value.status_code == 403
    assert exc.value.detail == INSUFFICIENT_PERMISSIONS


async def test_add_card_permission_other(db: AsyncMock, user: MagicMock) -> None:
    with _patch("add_card", side_effect=PermissionError("something_else")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.add_card(
                board_id=uuid.uuid4(), payload=_card_add(), db=db, current_user=user
            )
    assert exc.value.status_code == 403
    assert exc.value.detail == INSUFFICIENT_PERMISSIONS


async def test_add_card_already_on_board(db: AsyncMock, user: MagicMock) -> None:
    with _patch("add_card", side_effect=ValueError("ticket_already_on_board")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.add_card(
                board_id=uuid.uuid4(), payload=_card_add(), db=db, current_user=user
            )
    assert exc.value.status_code == 409
    assert exc.value.detail == "Ticket is already on this board"


async def test_add_card_value_error_other(db: AsyncMock, user: MagicMock) -> None:
    with _patch("add_card", side_effect=ValueError("bad input")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.add_card(
                board_id=uuid.uuid4(), payload=_card_add(), db=db, current_user=user
            )
    assert exc.value.status_code == 400
    assert exc.value.detail == "bad input"


# --- remove_card ---------------------------------------------------------


async def test_remove_card_success(db: AsyncMock, user: MagicMock) -> None:
    with _patch("remove_card", return_value=None):
        result = await kanban_router.remove_card(
            board_id=uuid.uuid4(), ticket_id=uuid.uuid4(), db=db, current_user=user
        )
    assert result is None


async def test_remove_card_lookup_default(db: AsyncMock, user: MagicMock) -> None:
    with _patch("remove_card", side_effect=LookupError("board_not_found")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.remove_card(
                board_id=uuid.uuid4(), ticket_id=uuid.uuid4(), db=db, current_user=user
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == NOT_FOUND


async def test_remove_card_card_not_found(db: AsyncMock, user: MagicMock) -> None:
    with _patch("remove_card", side_effect=LookupError("card_not_found")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.remove_card(
                board_id=uuid.uuid4(), ticket_id=uuid.uuid4(), db=db, current_user=user
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == "Card not found on board"


async def test_remove_card_forbidden(db: AsyncMock, user: MagicMock) -> None:
    with _patch("remove_card", side_effect=PermissionError()):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.remove_card(
                board_id=uuid.uuid4(), ticket_id=uuid.uuid4(), db=db, current_user=user
            )
    assert exc.value.status_code == 403
    assert exc.value.detail == INSUFFICIENT_PERMISSIONS


# --- move_card -----------------------------------------------------------


def _card_move() -> KanbanCardMove:
    return KanbanCardMove(column_id=uuid.uuid4(), position=0)


async def test_move_card_success(db: AsyncMock, user: MagicMock) -> None:
    sentinel = object()
    with _patch("move_card", return_value=sentinel):
        result = await kanban_router.move_card(
            board_id=uuid.uuid4(),
            ticket_id=uuid.uuid4(),
            payload=_card_move(),
            db=db,
            current_user=user,
        )
    assert result is sentinel


async def test_move_card_lookup_default(db: AsyncMock, user: MagicMock) -> None:
    with _patch("move_card", side_effect=LookupError("board_not_found")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.move_card(
                board_id=uuid.uuid4(),
                ticket_id=uuid.uuid4(),
                payload=_card_move(),
                db=db,
                current_user=user,
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == NOT_FOUND


async def test_move_card_column_not_found(db: AsyncMock, user: MagicMock) -> None:
    with _patch("move_card", side_effect=LookupError("column_not_found")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.move_card(
                board_id=uuid.uuid4(),
                ticket_id=uuid.uuid4(),
                payload=_card_move(),
                db=db,
                current_user=user,
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == COLUMN_NOT_FOUND


async def test_move_card_ticket_not_found(db: AsyncMock, user: MagicMock) -> None:
    with _patch("move_card", side_effect=LookupError("ticket_not_found")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.move_card(
                board_id=uuid.uuid4(),
                ticket_id=uuid.uuid4(),
                payload=_card_move(),
                db=db,
                current_user=user,
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == TICKET_NOT_FOUND


async def test_move_card_card_not_found(db: AsyncMock, user: MagicMock) -> None:
    with _patch("move_card", side_effect=LookupError("card_not_found")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.move_card(
                board_id=uuid.uuid4(),
                ticket_id=uuid.uuid4(),
                payload=_card_move(),
                db=db,
                current_user=user,
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == "Card not found on board"


async def test_move_card_forbidden(db: AsyncMock, user: MagicMock) -> None:
    with _patch("move_card", side_effect=PermissionError()):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.move_card(
                board_id=uuid.uuid4(),
                ticket_id=uuid.uuid4(),
                payload=_card_move(),
                db=db,
                current_user=user,
            )
    assert exc.value.status_code == 403
    assert exc.value.detail == INSUFFICIENT_PERMISSIONS


# --- create_column -------------------------------------------------------


async def test_create_column_success(db: AsyncMock, user: MagicMock) -> None:
    payload = KanbanColumnCreate(name="Backlog")
    sentinel = object()
    with _patch("create_column", return_value=sentinel):
        result = await kanban_router.create_column(
            board_id=uuid.uuid4(), payload=payload, db=db, current_user=user
        )
    assert result is sentinel


async def test_create_column_not_found(db: AsyncMock, user: MagicMock) -> None:
    payload = KanbanColumnCreate(name="Backlog")
    with _patch("create_column", side_effect=LookupError()):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.create_column(
                board_id=uuid.uuid4(), payload=payload, db=db, current_user=user
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == BOARD_NOT_FOUND


async def test_create_column_forbidden(db: AsyncMock, user: MagicMock) -> None:
    payload = KanbanColumnCreate(name="Backlog")
    with _patch("create_column", side_effect=PermissionError()):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.create_column(
                board_id=uuid.uuid4(), payload=payload, db=db, current_user=user
            )
    assert exc.value.status_code == 403
    assert exc.value.detail == INSUFFICIENT_PERMISSIONS


# --- update_column -------------------------------------------------------


async def test_update_column_success(db: AsyncMock, user: MagicMock) -> None:
    payload = KanbanColumnUpdate(name="I gang")
    sentinel = object()
    with _patch("update_column", return_value=sentinel):
        result = await kanban_router.update_column(
            board_id=uuid.uuid4(), column_id=uuid.uuid4(), payload=payload, db=db, current_user=user
        )
    assert result is sentinel


async def test_update_column_lookup_default(db: AsyncMock, user: MagicMock) -> None:
    payload = KanbanColumnUpdate(name="I gang")
    with _patch("update_column", side_effect=LookupError("board_not_found")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.update_column(
                board_id=uuid.uuid4(),
                column_id=uuid.uuid4(),
                payload=payload,
                db=db,
                current_user=user,
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == NOT_FOUND


async def test_update_column_column_not_found(db: AsyncMock, user: MagicMock) -> None:
    payload = KanbanColumnUpdate(name="I gang")
    with _patch("update_column", side_effect=LookupError("column_not_found")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.update_column(
                board_id=uuid.uuid4(),
                column_id=uuid.uuid4(),
                payload=payload,
                db=db,
                current_user=user,
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == COLUMN_NOT_FOUND


async def test_update_column_forbidden(db: AsyncMock, user: MagicMock) -> None:
    payload = KanbanColumnUpdate(name="I gang")
    with _patch("update_column", side_effect=PermissionError()):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.update_column(
                board_id=uuid.uuid4(),
                column_id=uuid.uuid4(),
                payload=payload,
                db=db,
                current_user=user,
            )
    assert exc.value.status_code == 403
    assert exc.value.detail == INSUFFICIENT_PERMISSIONS


# --- delete_column -------------------------------------------------------


async def test_delete_column_success(db: AsyncMock, user: MagicMock) -> None:
    with _patch("delete_column", return_value=None):
        result = await kanban_router.delete_column(
            board_id=uuid.uuid4(), column_id=uuid.uuid4(), db=db, current_user=user
        )
    assert result is None


async def test_delete_column_lookup_default(db: AsyncMock, user: MagicMock) -> None:
    with _patch("delete_column", side_effect=LookupError("board_not_found")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.delete_column(
                board_id=uuid.uuid4(), column_id=uuid.uuid4(), db=db, current_user=user
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == NOT_FOUND


async def test_delete_column_column_not_found(db: AsyncMock, user: MagicMock) -> None:
    with _patch("delete_column", side_effect=LookupError("column_not_found")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.delete_column(
                board_id=uuid.uuid4(), column_id=uuid.uuid4(), db=db, current_user=user
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == COLUMN_NOT_FOUND


async def test_delete_column_forbidden(db: AsyncMock, user: MagicMock) -> None:
    with _patch("delete_column", side_effect=PermissionError()):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.delete_column(
                board_id=uuid.uuid4(), column_id=uuid.uuid4(), db=db, current_user=user
            )
    assert exc.value.status_code == 403
    assert exc.value.detail == INSUFFICIENT_PERMISSIONS


async def test_delete_column_not_empty(db: AsyncMock, user: MagicMock) -> None:
    with _patch("delete_column", side_effect=ValueError("column_not_empty")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.delete_column(
                board_id=uuid.uuid4(), column_id=uuid.uuid4(), db=db, current_user=user
            )
    assert exc.value.status_code == 400
    assert exc.value.detail == "Column must be empty before deletion"


async def test_delete_column_value_error_other(db: AsyncMock, user: MagicMock) -> None:
    with _patch("delete_column", side_effect=ValueError("bad input")):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.delete_column(
                board_id=uuid.uuid4(), column_id=uuid.uuid4(), db=db, current_user=user
            )
    assert exc.value.status_code == 400
    assert exc.value.detail == "bad input"


# --- search_tickets ------------------------------------------------------


async def test_search_tickets_success(db: AsyncMock, user: MagicMock) -> None:
    sentinel = [object()]
    with _patch("search_tickets_for_board", return_value=sentinel):
        result = await kanban_router.search_tickets(
            board_id=uuid.uuid4(), q="printer", db=db, current_user=user
        )
    assert result is sentinel


async def test_search_tickets_not_found(db: AsyncMock, user: MagicMock) -> None:
    with _patch("search_tickets_for_board", side_effect=LookupError()):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.search_tickets(
                board_id=uuid.uuid4(), q="printer", db=db, current_user=user
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == BOARD_NOT_FOUND


async def test_search_tickets_forbidden(db: AsyncMock, user: MagicMock) -> None:
    with _patch("search_tickets_for_board", side_effect=PermissionError()):
        with pytest.raises(HTTPException) as exc:
            await kanban_router.search_tickets(
                board_id=uuid.uuid4(), q="printer", db=db, current_user=user
            )
    assert exc.value.status_code == 403
    assert exc.value.detail == INSUFFICIENT_PERMISSIONS
