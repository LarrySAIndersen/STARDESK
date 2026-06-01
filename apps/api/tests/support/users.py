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
) -> User:
    user = User()
    user.id = user_id or uuid.uuid4()
    user.email = email
    user.display_name = display_name
    user.role = role
    user.is_active = True
    user.password_hash = None
    user.must_change_password = False
    user.password_policy_exempt = False
    user.organization_id = organization_id
    user.deleted_at = None
    return user
