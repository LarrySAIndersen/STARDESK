from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.services import nav_visibility
from star_itsm_api.services import nav_visibility_paths


@pytest.mark.asyncio
async def test_get_hidden_nav_ids_empty_when_missing_row() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)

    hidden = await nav_visibility.get_hidden_nav_ids(mock_db)

    assert hidden == []


@pytest.mark.asyncio
async def test_get_hidden_nav_ids_filters_invalid_entries() -> None:
    row = MagicMock(value=["reports", "not-a-nav-id", "reports", 42])
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=row)

    hidden = await nav_visibility.get_hidden_nav_ids(mock_db)

    assert hidden == ["reports"]


@pytest.mark.asyncio
async def test_set_hidden_nav_ids_persists_normalized() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    result = await nav_visibility.set_hidden_nav_ids(
        mock_db,
        ["portal", "bogus", "portal"],
    )

    assert result == ["portal"]
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_is_nav_path_hidden_for_top_admin() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=MagicMock(value=["reports"]))

    hidden = await nav_visibility.is_nav_path_hidden_for_user(
        mock_db,
        path="/reports",
        is_top_admin=True,
    )

    assert hidden is False


@pytest.mark.asyncio
async def test_is_nav_path_hidden_for_regular_user() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=MagicMock(value=["reports"]))

    hidden = await nav_visibility.is_nav_path_hidden_for_user(
        mock_db,
        path="/reports/monthly",
        is_top_admin=False,
    )

    assert hidden is True


def test_nav_id_for_path_dashboard() -> None:
    assert nav_visibility_paths.nav_id_for_path("/") == "dashboard"


def test_nav_id_for_path_longest_prefix() -> None:
    assert nav_visibility_paths.nav_id_for_path("/tickets/new/abc") == "tickets-new"
    assert nav_visibility_paths.nav_id_for_path("/tickets/123") == "tickets"


def test_path_for_nav_id() -> None:
    assert nav_visibility_paths.path_for_nav_id("admin-sla") == "/admin/sla"
    assert nav_visibility_paths.path_for_nav_id("missing") is None
