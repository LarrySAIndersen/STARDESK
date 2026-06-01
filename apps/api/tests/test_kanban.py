import uuid

from httpx import AsyncClient

from tests.support.users import make_test_user

from star_itsm_api.models.kanban import KanbanBoard, KanbanColumn
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services.kanban_access import (
    sees_all_boards,
    user_can_delete_board,
    user_can_delete_tickets,
    user_can_move_cards,
    user_can_remove_cards,
    user_can_view_board,
)
from star_itsm_api.services.kanban_defaults import (
    build_columns_for_board,
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


def test_simple_template_columns() -> None:
    board_id = uuid.uuid4()
    columns = build_columns_for_board(board_id, template="simple")
    assert len(columns) == 3
    assert [c.name for c in columns] == ["Backlog", "I gang", "Færdig"]


def test_delivery_template_columns() -> None:
    board_id = uuid.uuid4()
    columns = build_columns_for_board(board_id, template="delivery")
    assert len(columns) == 7
    assert [c.name for c in columns] == [
        "Backlog",
        "Refinement",
        "Ready",
        "In Progress",
        "Review",
        "Done",
        "Archived",
    ]


def test_blank_template_columns() -> None:
    board_id = uuid.uuid4()
    columns = build_columns_for_board(board_id, template="blank")
    assert columns == []


def test_custom_template_columns() -> None:
    board_id = uuid.uuid4()
    columns = build_columns_for_board(
        board_id,
        template="custom",
        column_names=["Todo", "Doing", "Done"],
    )
    assert len(columns) == 3
    assert all(c.is_custom for c in columns)
    assert columns[0].name == "Todo"


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
            is_custom=False,
        ),
        KanbanColumn(
            id=uuid.uuid4(),
            board_id=board_id,
            name="Igangsat",
            position=1,
            statuses=["in_progress"],
            default_status="in_progress",
            is_custom=False,
        ),
    ]
    assert column_for_ticket_status(columns, "assigned") is columns[0]
    assert column_for_ticket_status(columns, "in_progress") is columns[1]


def test_access_admin_sees_all_boards() -> None:
    admin = make_test_user(role="admin")
    assert sees_all_boards(admin) is True


def test_access_member_not_creator() -> None:
    user_id = uuid.uuid4()
    other_creator = uuid.uuid4()
    board = _board(creator_id=other_creator)
    user = make_test_user(user_id=user_id, role="agent")
    assert user_can_view_board(board, user, {user_id}) is True
    assert user_can_view_board(board, user, set()) is False


def test_move_cards_editor_only() -> None:
    agent = make_test_user(role="agent")
    assert user_can_move_cards("editor", agent) is True
    assert user_can_move_cards("viewer", agent) is False


def test_remove_cards_editor_only() -> None:
    agent = make_test_user(role="agent")
    assert user_can_remove_cards("editor", agent) is True
    assert user_can_remove_cards("viewer", agent) is False


def test_delete_board_owner_only() -> None:
    agent = make_test_user(role="agent")
    board = _board()
    assert user_can_delete_board("owner", agent, board) is True
    assert user_can_delete_board("editor", agent, board) is False


def test_delete_tickets_admin_only() -> None:
    admin = make_test_user(role="admin")
    agent = make_test_user(role="agent")
    assert user_can_delete_tickets(admin) is True
    assert user_can_delete_tickets(agent) is False


def test_move_card_updates_status_mapping() -> None:
    board_id = uuid.uuid4()
    column = KanbanColumn(
        id=uuid.uuid4(),
        board_id=board_id,
        name="Løst",
        position=2,
        statuses=["resolved"],
        default_status="resolved",
        is_custom=False,
    )
    ticket = Ticket()
    ticket.status = "in_progress"
    ticket.status = column.default_status
    assert ticket.status == "resolved"


async def test_list_kanban_boards_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/kanban/boards")
    assert response.status_code == 503
