"""Test user fixtures (typed User instances for Sonar S5655)."""

from __future__ import annotations

import uuid

from star_itsm_api.models.user import User


def make_test_user(
    *,
    user_id: uuid.UUID | None = None,
    role: str = "agent",
    email: str = "test@example.dk",
    display_name: str = "Test User",
    organization_id: uuid.UUID | None = None,
    ui_mode: str | None = None,
    password_hash: str | None = None,
    must_change_password: bool = False,
    password_policy_exempt: bool = False,
) -> User:
    user = User()
    user.id = user_id or uuid.uuid4()
    user.email = email
    user.display_name = display_name
    user.role = role
    user.is_active = True
    user.password_hash = password_hash
    user.must_change_password = must_change_password
    user.password_policy_exempt = password_policy_exempt
    user.organization_id = organization_id
    user.deleted_at = None
    user.ui_mode = ui_mode
    return user
