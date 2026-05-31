"""Kanban board visibility and member roles."""

from __future__ import annotations

import uuid

from star_itsm_api.models.kanban import (
    KANBAN_ROLE_EDITOR,
    KANBAN_ROLE_OWNER,
    KanbanBoard,
)
from star_itsm_api.models.user import User
from star_itsm_api.services.permissions import can_manage_users

EDIT_ROLES = frozenset({KANBAN_ROLE_OWNER, KANBAN_ROLE_EDITOR})
MOVE_ROLES = frozenset({KANBAN_ROLE_OWNER, KANBAN_ROLE_EDITOR})


def sees_all_boards(user: User) -> bool:
    return can_manage_users(user)


def user_created_board(board: KanbanBoard, user_id: uuid.UUID) -> bool:
    return board.created_by_user_id == user_id


def resolve_member_role(
    board: KanbanBoard,
    user: User,
    member_roles: dict[uuid.UUID, str],
) -> str | None:
    if user_created_board(board, user.id):
        return KANBAN_ROLE_OWNER
    return member_roles.get(user.id)


def user_can_view_board(
    board: KanbanBoard,
    user: User,
    member_user_ids: set[uuid.UUID],
) -> bool:
    if board.deleted_at is not None:
        return False
    if sees_all_boards(user):
        return True
    if user_created_board(board, user.id):
        return True
    return user.id in member_user_ids


def user_can_edit_board(role: str | None, user: User, board: KanbanBoard) -> bool:
    if sees_all_boards(user):
        return True
    if role == KANBAN_ROLE_OWNER or user_created_board(board, user.id):
        return True
    return role in EDIT_ROLES


def user_can_move_cards(role: str | None, user: User) -> bool:
    if sees_all_boards(user):
        return True
    return role in MOVE_ROLES


def user_can_remove_cards(role: str | None, user: User) -> bool:
    if sees_all_boards(user):
        return True
    return role in EDIT_ROLES


def user_can_delete_board(role: str | None, user: User, board: KanbanBoard) -> bool:
    if sees_all_boards(user):
        return True
    if role == KANBAN_ROLE_OWNER:
        return True
    user_id = getattr(user, "id", None)
    if user_id is not None and user_created_board(board, user_id):
        return True
    return False


def user_can_delete_tickets(user: User) -> bool:
    return sees_all_boards(user)
