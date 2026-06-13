import pytest

from star_itsm_api.services import nav_visibility
from star_itsm_api.services.nav_visibility_paths import nav_id_for_path, path_for_nav_id


def test_path_for_nav_id_known_routes() -> None:
    assert path_for_nav_id("tickets") == "/tickets"
    assert path_for_nav_id("unknown") is None


def test_nav_id_for_path_longest_prefix_wins() -> None:
    assert nav_id_for_path("/") == "dashboard"
    assert nav_id_for_path("/tickets/new") == "tickets-new"
    assert nav_id_for_path("/sitemap") == "sitemap"
    assert nav_id_for_path("/chat") == "team-chat"
    assert nav_id_for_path("/admin/chatbot") == "admin-chatbot"
    assert nav_id_for_path("/integrations/slack/callback") == "integration-slack"
    assert nav_id_for_path("/system-dokumentation") == "system-dokumentation"
    assert nav_id_for_path("/nope") is None


def test_nav_id_for_path_shorter_prefix_ignored() -> None:
    from star_itsm_api.services.nav_visibility_paths import NAV_PATH_BY_ID
    NAV_PATH_BY_ID["temp-long"] = "/temp/long"
    NAV_PATH_BY_ID["temp-short"] = "/temp"
    try:
        assert nav_id_for_path("/temp/long") == "temp-long"
    finally:
        del NAV_PATH_BY_ID["temp-long"]
        del NAV_PATH_BY_ID["temp-short"]


def test_normalize_ids_filters_invalid() -> None:
    raw = [
        "tickets",
        "bogus",
        "tickets",
        42,
        "portal",
        "sitemap",
        "team-chat",
        "admin-chatbot",
        "kundeportal-2",
        "arbejdsrum",
        "dependency-track",
        "kanban",
        "backlog",
        "min-side",
        "forbedringer",
        "saglayout-2",
    ]
    assert nav_visibility._normalize_ids(raw) == [
        "tickets",
        "portal",
        "sitemap",
        "team-chat",
        "admin-chatbot",
        "kundeportal-2",
        "arbejdsrum",
        "dependency-track",
        "kanban",
        "backlog",
        "min-side",
        "forbedringer",
        "saglayout-2",
    ]
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
