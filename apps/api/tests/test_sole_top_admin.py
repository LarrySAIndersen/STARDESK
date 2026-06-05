from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.core.security import ROLE_ADMIN, ROLE_TOP_ADMIN
from star_itsm_api.models.user import User
from star_itsm_api.services.sole_top_admin import enforce_sole_top_admin_on_login


@pytest.mark.asyncio
async def test_enforce_no_changes_needed() -> None:
    mock_db = AsyncMock()
    # Mock others to return empty list
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_result

    user = User(email="larrysanders@example.dk", role=ROLE_TOP_ADMIN)

    await enforce_sole_top_admin_on_login(mock_db, user)

    assert user.role == ROLE_TOP_ADMIN
    mock_db.commit.assert_not_called()
    mock_db.refresh.assert_not_called()


@pytest.mark.asyncio
async def test_enforce_demote_invalid_top_admin() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_result

    user = User(email="sf01@example.dk", role=ROLE_TOP_ADMIN)

    await enforce_sole_top_admin_on_login(mock_db, user)

    assert user.role == ROLE_ADMIN
    mock_db.commit.assert_awaited_once()
    mock_db.refresh.assert_awaited_once_with(user)


@pytest.mark.asyncio
async def test_enforce_promote_sole_top_admin() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_result

    user = User(email="larrysanders@example.dk", role=ROLE_ADMIN)

    await enforce_sole_top_admin_on_login(mock_db, user)

    assert user.role == ROLE_TOP_ADMIN
    mock_db.commit.assert_awaited_once()
    mock_db.refresh.assert_awaited_once_with(user)


@pytest.mark.asyncio
async def test_enforce_demote_other_top_admins() -> None:
    mock_db = AsyncMock()
    other_user = User(email="sf01@example.dk", role=ROLE_TOP_ADMIN)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [other_user]
    mock_db.execute.return_value = mock_result

    user = User(email="larrysanders@example.dk", role=ROLE_TOP_ADMIN)

    await enforce_sole_top_admin_on_login(mock_db, user)

    assert user.role == ROLE_TOP_ADMIN
    assert other_user.role == ROLE_ADMIN
    mock_db.commit.assert_awaited_once()
    mock_db.refresh.assert_awaited_once_with(user)
