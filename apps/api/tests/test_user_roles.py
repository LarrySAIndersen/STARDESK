"""Tests for multi-role user assignments."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.core.security import ROLE_AGENT, ROLE_STARDESK_REVIEWER, ROLE_SUBMITTER
from star_itsm_api.services.user_roles import (
    attach_roles_to_user,
    primary_role_from_set,
    sync_user_roles,
    user_has_any_role,
    user_role_set,
)


def test_primary_role_from_set_prefers_highest_privilege() -> None:
    assert primary_role_from_set({ROLE_SUBMITTER, ROLE_AGENT}) == ROLE_AGENT
    assert primary_role_from_set({ROLE_STARDESK_REVIEWER, ROLE_AGENT}) == ROLE_AGENT


def test_user_role_set_uses_cache() -> None:
    user = MagicMock(role=ROLE_SUBMITTER)
    attach_roles_to_user(user, [ROLE_AGENT, ROLE_STARDESK_REVIEWER])
    assert user_role_set(user) == frozenset({ROLE_AGENT, ROLE_STARDESK_REVIEWER})
    assert user_has_any_role(user, ROLE_STARDESK_REVIEWER)


@pytest.mark.asyncio
async def test_sync_user_roles_replaces_assignments() -> None:
    db = AsyncMock()
    user_id = uuid.uuid4()
    primary = await sync_user_roles(
        db,
        user_id,
        [ROLE_STARDESK_REVIEWER, ROLE_AGENT],
    )
    assert primary == ROLE_AGENT
    assert db.add.called
