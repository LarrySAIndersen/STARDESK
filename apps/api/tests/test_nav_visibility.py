import pytest

from star_itsm_api.services import nav_visibility
from star_itsm_api.services.nav_visibility_paths import nav_id_for_path, path_for_nav_id


def test_path_for_nav_id_known_routes() -> None:
    assert path_for_nav_id("tickets") == "/tickets"
    assert path_for_nav_id("unknown") is None


def test_nav_id_for_path_longest_prefix_wins() -> None:
    assert nav_id_for_path("/") == "dashboard"
    assert nav_id_for_path("/tickets/new") == "tickets-new"
    assert nav_id_for_path("/integrations/slack/callback") == "integration-slack"
    assert nav_id_for_path("/nope") is None


def test_normalize_ids_filters_invalid() -> None:
    raw = ["tickets", "bogus", "tickets", 42, "portal"]
    assert nav_visibility._normalize_ids(raw) == ["tickets", "portal"]
    assert nav_visibility._normalize_ids("not-a-list") == []


@pytest.mark.asyncio
async def test_get_hidden_nav_ids_empty_when_no_row() -> None:
    from unittest.mock import AsyncMock

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)

    hidden = await nav_visibility.get_hidden_nav_ids(mock_db)

    assert hidden == []


@pytest.mark.asyncio
async def test_is_nav_path_hidden_for_top_admin_always_false() -> None:
    from unittest.mock import AsyncMock

    mock_db = AsyncMock()
    hidden = await nav_visibility.is_nav_path_hidden_for_user(
        mock_db,
        path="/tickets",
        is_top_admin=True,
    )
    assert hidden is False
    mock_db.get.assert_not_awaited()
