"""Slack integration router tests — mirror gmail router coverage."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from star_itsm_api.core.config import settings
from star_itsm_api.core.security import get_current_user
from star_itsm_api.main import app
from star_itsm_api.models.organization_integration import OrganizationIntegration
from star_itsm_api.models.user import User
from star_itsm_api.services.slack import SlackApiError, SlackWorkspaceConnection

SF_OPS_ORG_ID = uuid.UUID("e1000001-0000-4000-8000-000000000003")
LARRY_ID = uuid.UUID("00000000-0000-0000-0000-000000000040")


def _rows_result(rows: list[tuple[object, ...]]) -> MagicMock:
    result = MagicMock()
    result.all.return_value = rows
    return result


def _larry_admin() -> User:
    return User(
        id=LARRY_ID,
        email="larrysanders@example.dk",
        display_name="Larry",
        role="admin",
        is_active=True,
        organization_id=None,
    )


@pytest.mark.asyncio
async def test_slack_oauth_callback_success(api_client: AsyncClient) -> None:
    connection = SlackWorkspaceConnection(
        team_id="T123",
        team_name="STAR Ops",
        bot_token="xoxb-test",
    )
    with (
        patch(
            "star_itsm_api.routers.slack.parse_oauth_state",
            return_value=(SF_OPS_ORG_ID, LARRY_ID),
        ),
        patch(
            "star_itsm_api.routers.slack.exchange_oauth_code",
            new_callable=AsyncMock,
            return_value=connection,
        ),
        patch(
            "star_itsm_api.routers.slack.upsert_slack_integration",
            new_callable=AsyncMock,
        ),
    ):
        response = await api_client.get(
            "/api/v1/integrations/slack/oauth/callback",
            params={"code": "oauth-code", "state": "state-token"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["connected"] is True
    assert body["team_id"] == "T123"


@pytest.mark.asyncio
async def test_slack_oauth_callback_error(api_client: AsyncClient) -> None:
    response = await api_client.get(
        "/api/v1/integrations/slack/oauth/callback",
        params={"error": "access_denied"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_slack_status_connected(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    override_db.execute = AsyncMock(
        return_value=_rows_result([(SF_OPS_ORG_ID, "SF Operations")]),
    )
    integration = OrganizationIntegration(
        organization_id=SF_OPS_ORG_ID,
        provider="slack",
        slack_bot_token="xoxb-test",
        slack_team_id="T123",
        slack_team_name="STAR Ops",
        enabled=True,
    )
    try:
        with patch(
            "star_itsm_api.routers.slack.get_slack_integration",
            new_callable=AsyncMock,
            return_value=integration,
        ):
            response = await api_client.get("/api/v1/integrations/slack/status")
        assert response.status_code == 200
        assert response.json()["connected"] is True
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_slack_settings_update(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    override_db.execute = AsyncMock(
        return_value=_rows_result([(SF_OPS_ORG_ID, "SF Operations")]),
    )
    integration = OrganizationIntegration(
        organization_id=SF_OPS_ORG_ID,
        provider="slack",
        slack_bot_token="xoxb-test",
        enabled=True,
    )
    try:
        with patch(
            "star_itsm_api.routers.slack.save_slack_preferences",
            new_callable=AsyncMock,
            return_value=integration,
        ):
            response = await api_client.patch(
                "/api/v1/integrations/slack/settings",
                json={"enabled": True},
            )
        assert response.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_slack_disconnect(
    override_db: AsyncMock,
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    monkeypatch.setattr(settings, "slack_mock", True)
    override_db.execute = AsyncMock(
        return_value=_rows_result([(SF_OPS_ORG_ID, "SF Operations")]),
    )
    try:
        with patch(
            "star_itsm_api.routers.slack.disconnect_slack",
            new_callable=AsyncMock,
        ):
            response = await api_client.post("/api/v1/integrations/slack/disconnect")
        assert response.status_code == 200
        assert response.json()["connected"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_slack_channels_mock(
    override_db: AsyncMock,
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    monkeypatch.setattr(settings, "slack_mock", True)
    override_db.execute = AsyncMock(
        return_value=_rows_result([(SF_OPS_ORG_ID, "SF Operations")]),
    )
    try:
        with patch(
            "star_itsm_api.routers.slack.get_slack_integration",
            new_callable=AsyncMock,
            return_value=None,
        ):
            response = await api_client.get("/api/v1/integrations/slack/channels")
        assert response.status_code == 200
        assert len(response.json()) >= 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_slack_channels_fetch_error(
    override_db: AsyncMock,
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    monkeypatch.setattr(settings, "slack_mock", False)
    override_db.execute = AsyncMock(
        return_value=_rows_result([(SF_OPS_ORG_ID, "SF Operations")]),
    )
    integration = OrganizationIntegration(
        organization_id=SF_OPS_ORG_ID,
        provider="slack",
        slack_bot_token="xoxb-test",
    )
    try:
        with (
            patch(
                "star_itsm_api.routers.slack.get_slack_integration",
                new_callable=AsyncMock,
                return_value=integration,
            ),
            patch(
                "star_itsm_api.routers.slack.fetch_channels",
                new_callable=AsyncMock,
                side_effect=SlackApiError("Slack API fejl"),
            ),
        ):
            response = await api_client.get("/api/v1/integrations/slack/channels")
        assert response.status_code == 502
    finally:
        app.dependency_overrides.pop(get_current_user, None)
