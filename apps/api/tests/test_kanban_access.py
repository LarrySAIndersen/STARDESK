import uuid
from unittest.mock import MagicMock, patch

from star_itsm_api.core.security import ROLE_ADMIN, ROLE_SUBMITTER
from star_itsm_api.models.kanban import (
    KANBAN_ROLE_EDITOR,
    KANBAN_ROLE_OWNER,
)
from star_itsm_api.services.kanban_access import (
    sees_all_boards,
    user_created_board,
    resolve_member_role,
    user_can_view_board,
    user_can_edit_board,
    user_can_move_cards,
    user_can_remove_cards,
    user_can_delete_board,
    user_can_delete_tickets,
)


def test_sees_all_boards() -> None:
    # Admin sees all boards
    user_admin = MagicMock()
    user_admin.role = ROLE_ADMIN
    assert sees_all_boards(user_admin) is True

    # Submitter does not see all boards
    user_sub = MagicMock()
    user_sub.role = ROLE_SUBMITTER
    assert sees_all_boards(user_sub) is False


def test_user_created_board() -> None:
    user_id = uuid.uuid4()
    board = MagicMock()
    board.created_by_user_id = user_id
    assert user_created_board(board, user_id) is True
    assert user_created_board(board, uuid.uuid4()) is False


def test_resolve_member_role() -> None:
    owner_id = uuid.uuid4()
    user = MagicMock()
    user.id = owner_id
    board = MagicMock()
    board.created_by_user_id = owner_id

    # Created by user: owner role
    assert resolve_member_role(board, user, {}) == KANBAN_ROLE_OWNER

    # Not created by user: check member roles dictionary
    other_user_id = uuid.uuid4()
    user.id = other_user_id
    member_roles = {other_user_id: KANBAN_ROLE_EDITOR}
    assert resolve_member_role(board, user, member_roles) == KANBAN_ROLE_EDITOR
    assert resolve_member_role(board, user, {}) is None


def test_user_can_view_board() -> None:
    # Deleted board is always hidden
    board = MagicMock()
    board.deleted_at = "2026-06-05"
    user = MagicMock()
    user.id = uuid.uuid4()
    assert user_can_view_board(board, user, set()) is False

    # Active board
    board.deleted_at = None

    # Admin can view
    user_admin = MagicMock()
    user_admin.role = ROLE_ADMIN
    assert user_can_view_board(board, user_admin, set()) is True

    # Creator can view
    user_creator = MagicMock()
    user_creator.role = ROLE_SUBMITTER
    user_creator.id = uuid.uuid4()
    board.created_by_user_id = user_creator.id
    assert user_can_view_board(board, user_creator, set()) is True

    # Member can view
    user_member = MagicMock()
    user_member.role = ROLE_SUBMITTER
    user_member.id = uuid.uuid4()
    board.created_by_user_id = uuid.uuid4()  # different creator
    assert user_can_view_board(board, user_member, {user_member.id}) is True

    # Non-member cannot view
    assert user_can_view_board(board, user_member, set()) is False


def test_user_can_edit_board() -> None:
    # Admin can edit
    user_admin = MagicMock()
    user_admin.role = ROLE_ADMIN
    board = MagicMock()
    board.created_by_user_id = uuid.uuid4()
    assert user_can_edit_board(None, user_admin, board) is True

    # Owner can edit
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    user.id = uuid.uuid4()
    assert user_can_edit_board(KANBAN_ROLE_OWNER, user, board) is True

    # Creator can edit
    board.created_by_user_id = user.id
    assert user_can_edit_board(None, user, board) is True

    # Editor can edit
    board.created_by_user_id = uuid.uuid4()  # different creator
    assert user_can_edit_board(KANBAN_ROLE_EDITOR, user, board) is True

    # Viewer cannot edit
    assert user_can_edit_board("viewer", user, board) is False


def test_user_can_move_cards() -> None:
    # Admin can move
    user_admin = MagicMock()
    user_admin.role = ROLE_ADMIN
    assert user_can_move_cards(None, user_admin) is True

    # Owner can move
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    assert user_can_move_cards(KANBAN_ROLE_OWNER, user) is True

    # Editor can move
    assert user_can_move_cards(KANBAN_ROLE_EDITOR, user) is True

    # Viewer cannot move
    assert user_can_move_cards("viewer", user) is False


def test_user_can_remove_cards() -> None:
    # Admin can remove
    user_admin = MagicMock()
    user_admin.role = ROLE_ADMIN
    assert user_can_remove_cards(None, user_admin) is True

    # Editor can remove
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    assert user_can_remove_cards(KANBAN_ROLE_EDITOR, user) is True

    # Viewer cannot remove
    assert user_can_remove_cards("viewer", user) is False


def test_user_can_delete_board() -> None:
    # Admin can delete
    user_admin = MagicMock()
    user_admin.role = ROLE_ADMIN
    board = MagicMock()
    board.created_by_user_id = uuid.uuid4()
    assert user_can_delete_board(None, user_admin, board) is True

    # Owner can delete
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    user.id = uuid.uuid4()
    assert user_can_delete_board(KANBAN_ROLE_OWNER, user, board) is True

    # Creator can delete
    board.created_by_user_id = user.id
    assert user_can_delete_board(None, user, board) is True

    # Missing user ID cannot delete (safety check)
    user_no_id = MagicMock()
    user_no_id.role = ROLE_SUBMITTER
    del user_no_id.id
    # Property gets mock attribute unless we explicitly mock/raise/or use spec
    # So we'll use a user dict object or mock getattr returning None
    with patch("star_itsm_api.services.kanban_access.getattr", return_value=None):
        assert user_can_delete_board(None, user_no_id, board) is False

    # Editor cannot delete
    board.created_by_user_id = uuid.uuid4()
    assert user_can_delete_board(KANBAN_ROLE_EDITOR, user, board) is False


def test_user_can_delete_tickets() -> None:
    # Admin can delete tickets
    user_admin = MagicMock()
    user_admin.role = ROLE_ADMIN
    assert user_can_delete_tickets(user_admin) is True

    # Submitter cannot delete tickets
    user_sub = MagicMock()
    user_sub.role = ROLE_SUBMITTER
    assert user_can_delete_tickets(user_sub) is False
