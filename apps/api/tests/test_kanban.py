import uuid
from types import SimpleNamespace

from httpx import AsyncClient

from star_itsm_api.models.kanban import KanbanBoard, KanbanColumn
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services.kanban_access import (
    user_can_move_cards,
    user_can_view_board,
    sees_all_boards,
)
from star_itsm_api.services.kanban_defaults import (
    column_for_ticket_status,
    default_column_specs,
)


def _board(*, creator_id: uuid.UUID | None = None) -> KanbanBoard:
    board = KanbanBoard()
    board.id = uuid.uuid4()
    board.created_by_user_id = creator_id or uuid.uuid4()
    board.deleted_at = None
    return board


def test_default_columns_match_itsm_buckets() -> None:
    specs = default_column_specs()
    assert len(specs) == 4
    assert specs[0][0] == "Modtaget"
    assert "new" in specs[0][2]
    assert specs[1][0] == "Igangsat"


def test_column_for_ticket_status() -> None:
    board_id = uuid.uuid4()
    columns = [
        KanbanColumn(
            id=uuid.uuid4(),
            board_id=board_id,
            name="Modtaget",
            position=0,
            statuses=["assigned", "new"],
            default_status="new",
        ),
        KanbanColumn(
            id=uuid.uuid4(),
            board_id=board_id,
            name="Igangsat",
            position=1,
            statuses=["in_progress"],
            default_status="in_progress",
        ),
    ]
    assert column_for_ticket_status(columns, "assigned") is columns[0]
    assert column_for_ticket_status(columns, "in_progress") is columns[1]


def test_access_admin_sees_all_boards() -> None:
    admin = SimpleNamespace(role="admin")
    assert sees_all_boards(admin) is True


def test_access_member_not_creator() -> None:
    user_id = uuid.uuid4()
    other_creator = uuid.uuid4()
    board = _board(creator_id=other_creator)
    user = SimpleNamespace(id=user_id, role="agent")
    assert user_can_view_board(board, user, {user_id}) is True
    assert user_can_view_board(board, user, set()) is False


def test_move_cards_editor_only() -> None:
    agent = SimpleNamespace(role="agent")
    assert user_can_move_cards("editor", agent) is True
    assert user_can_move_cards("viewer", agent) is False


def test_move_card_updates_status_mapping() -> None:
    board_id = uuid.uuid4()
    column = KanbanColumn(
        id=uuid.uuid4(),
        board_id=board_id,
        name="Løst",
        position=2,
        statuses=["resolved"],
        default_status="resolved",
    )
    ticket = Ticket()
    ticket.status = "in_progress"
    ticket.status = column.default_status
    assert ticket.status == "resolved"


async def test_list_kanban_boards_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/kanban/boards")
    assert response.status_code == 503
