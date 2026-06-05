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
    assert primary_role_from_set(set()) == ROLE_SUBMITTER


def test_user_role_set_uses_cache() -> None:
    user = MagicMock(role=ROLE_SUBMITTER)
    attach_roles_to_user(user, [ROLE_AGENT, ROLE_STARDESK_REVIEWER])
    assert user_role_set(user) == frozenset({ROLE_AGENT, ROLE_STARDESK_REVIEWER})
    assert user_has_any_role(user, ROLE_STARDESK_REVIEWER)


def test_user_role_set_no_cache() -> None:
    user = MagicMock(role=ROLE_SUBMITTER)
    # Delete _roles_cache if it exists on MagicMock
    if hasattr(user, "_roles_cache"):
        delattr(user, "_roles_cache")
    assert user_role_set(user) == frozenset({ROLE_SUBMITTER})


def test_role_labels_for_values() -> None:
    from star_itsm_api.services.user_roles import role_labels_for_values
    labels = {"agent": "Support Agent", "admin": "Administrator"}
    assert role_labels_for_values(["agent", "admin", "other"], labels) == ["Support Agent", "Administrator", "other"]


@pytest.mark.asyncio
async def test_fetch_user_roles_success() -> None:
    from star_itsm_api.services.user_roles import fetch_user_roles
    db = AsyncMock()
    user_id = uuid.uuid4()
    
    # Mock database returning roles
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = ["agent", "stardesk_reviewer"]
    db.execute = AsyncMock(return_value=mock_result)
    
    roles = await fetch_user_roles(db, user_id)
    assert roles == ["agent", "stardesk_reviewer"]


@pytest.mark.asyncio
async def test_fetch_user_roles_fallback_to_user_role() -> None:
    from star_itsm_api.services.user_roles import fetch_user_roles
    db = AsyncMock()
    user_id = uuid.uuid4()
    
    # Mock db.execute returning empty list of roles
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=mock_result)
    
    # Mock db.get returning user
    user = MagicMock(role="admin")
    db.get = AsyncMock(return_value=user)
    
    roles = await fetch_user_roles(db, user_id)
    assert roles == ["admin"]


@pytest.mark.asyncio
async def test_fetch_user_roles_user_not_found() -> None:
    from star_itsm_api.services.user_roles import fetch_user_roles
    db = AsyncMock()
    user_id = uuid.uuid4()
    
    # Mock db.execute returning empty list of roles
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=mock_result)
    
    # Mock db.get returning None
    db.get = AsyncMock(return_value=None)
    
    roles = await fetch_user_roles(db, user_id)
    assert roles == []


@pytest.mark.asyncio
async def test_fetch_user_roles_bulk() -> None:
    from star_itsm_api.services.user_roles import fetch_user_roles_bulk
    db = AsyncMock()
    
    # Empty user_ids list
    assert await fetch_user_roles_bulk(db, []) == {}
    
    user_id1 = uuid.uuid4()
    user_id2 = uuid.uuid4()
    
    mock_result = MagicMock()
    mock_result.all.return_value = [(user_id1, "agent"), (user_id1, "admin"), (user_id2, "supporter")]
    db.execute = AsyncMock(return_value=mock_result)
    
    grouped = await fetch_user_roles_bulk(db, [user_id1, user_id2])
    assert grouped[user_id1] == ["agent", "admin"]
    assert grouped[user_id2] == ["supporter"]


@pytest.mark.asyncio
async def test_ensure_user_roles_loaded() -> None:
    from star_itsm_api.services.user_roles import ensure_user_roles_loaded
    db = AsyncMock()
    
    # 1. Already cached
    user_cached = MagicMock(role="admin")
    attach_roles_to_user(user_cached, ["admin", "agent"])
    roles = await ensure_user_roles_loaded(db, user_cached)
    assert roles == ["admin", "agent"]
    
    # 2. Not cached, fetch returns roles
    user_not_cached = MagicMock(id=uuid.uuid4(), role="admin")
    if hasattr(user_not_cached, "_roles_cache"):
        delattr(user_not_cached, "_roles_cache")
        
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = ["admin", "supporter"]
    db.execute = AsyncMock(return_value=mock_result)
    
    roles = await ensure_user_roles_loaded(db, user_not_cached)
    assert roles == ["admin", "supporter"]
    assert getattr(user_not_cached, "_roles_cache") == frozenset({"admin", "supporter"})

    # 3. Not cached, fetch returns empty, falls back to user.role
    user_fallback = MagicMock(id=uuid.uuid4(), role="supporter")
    if hasattr(user_fallback, "_roles_cache"):
        delattr(user_fallback, "_roles_cache")
        
    mock_result_empty = MagicMock()
    mock_result_empty.scalars.return_value.all.return_value = []
    
    db.execute = AsyncMock(return_value=mock_result_empty)
    db.get = AsyncMock(return_value=None)  # Make fetch_user_roles return []
    
    roles_fallback = await ensure_user_roles_loaded(db, user_fallback)
    assert roles_fallback == ["supporter"]
    assert getattr(user_fallback, "_roles_cache") == frozenset({"supporter"})




@pytest.mark.asyncio
async def test_sync_user_roles_empty_roles() -> None:
    db = AsyncMock()
    user_id = uuid.uuid4()
    with pytest.raises(ValueError, match="roles_required"):
        await sync_user_roles(db, user_id, [])


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
