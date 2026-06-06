import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock

import jwt
import pytest

from star_itsm_api.core.config import settings
from star_itsm_api.models.organization_integration import OrganizationIntegration
from star_itsm_api.services.slack import (
    SlackApiError,
    build_oauth_authorize_url,
    create_oauth_state,
    disconnect_slack,
    exchange_oauth_code,
    fetch_channels,
    get_slack_integration,
    parse_oauth_state,
    post_ticket_message,
    save_slack_preferences,
    upsert_slack_integration,
)


class _FakeResponse:
    def __init__(self, status_code: int, data: dict):
        self.status_code = status_code
        self._data = data

    def json(self) -> dict:
        return self._data


class _FakeAsyncClient:
    def __init__(self, *, response: _FakeResponse):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, *args, **kwargs):  # noqa: ANN002, ANN003
        await asyncio.sleep(0)
        return self._response

    async def get(self, *args, **kwargs):  # noqa: ANN002, ANN003
        await asyncio.sleep(0)
        return self._response


@pytest.fixture
def slack_oauth_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "slack_client_id", "slack-client-id")
    monkeypatch.setattr(settings, "slack_client_secret", "slack-client-secret")
    monkeypatch.setattr(settings, "slack_redirect_uri", "https://app.example.dk/slack/callback")
    monkeypatch.setattr(settings, "jwt_secret", "test-jwt-secret-for-slack-oauth-tests")


def test_create_and_parse_oauth_state_roundtrip(slack_oauth_env: None) -> None:
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    state = create_oauth_state(org_id=org_id, user_id=user_id)
    parsed_org, parsed_user = parse_oauth_state(state)
    assert parsed_org == org_id
    assert parsed_user == user_id


def test_parse_oauth_state_rejects_wrong_purpose(slack_oauth_env: None) -> None:
    token = jwt.encode(
        {
            "org_id": str(uuid.uuid4()),
            "user_id": str(uuid.uuid4()),
            "purpose": "other",
            "exp": 9999999999,
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    with pytest.raises(SlackApiError, match="Ugyldig Slack OAuth state"):
        parse_oauth_state(token)


def test_build_oauth_authorize_url_contains_client_and_state(slack_oauth_env: None) -> None:
    url = build_oauth_authorize_url(state="abc123")
    assert url.startswith("https://slack.com/oauth/v2/authorize?")
    assert "client_id=slack-client-id" in url
    assert "state=abc123" in url


def test_require_oauth_settings_missing_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "slack_client_id", None)
    with pytest.raises(SlackApiError, match="OAuth mangler"):
        build_oauth_authorize_url(state="x")


@pytest.mark.asyncio
async def test_exchange_oauth_code_success(monkeypatch: pytest.MonkeyPatch, slack_oauth_env: None) -> None:
    import star_itsm_api.services.slack as slack_service

    response = _FakeResponse(
        200,
        {
            "ok": True,
            "access_token": "xoxb-test",
            "team": {"id": "T123", "name": "STAR Workspace"},
        },
    )
    monkeypatch.setattr(
        slack_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(response=response),
    )
    connection = await exchange_oauth_code("oauth-code")
    assert connection.team_id == "T123"
    assert connection.bot_token == "xoxb-test"


@pytest.mark.asyncio
async def test_fetch_channels_success(monkeypatch: pytest.MonkeyPatch) -> None:
    import star_itsm_api.services.slack as slack_service

    response = _FakeResponse(
        200,
        {
            "ok": True,
            "channels": [
                {"id": "C200", "name": "it-support", "is_private": False},
                {"id": "C100", "name": "general", "is_private": True},
            ],
        },
    )
    monkeypatch.setattr(
        slack_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(response=response),
    )
    channels = await fetch_channels("xoxb-test")
    assert [channel.name for channel in channels] == ["general", "it-support"]
    assert channels[0].is_private is True


@pytest.mark.asyncio
async def test_post_ticket_message_success(monkeypatch: pytest.MonkeyPatch) -> None:
    import star_itsm_api.services.slack as slack_service

    response = _FakeResponse(200, {"ok": True, "channel": "C123", "ts": "171234.000001"})
    monkeypatch.setattr(
        slack_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(response=response),
    )

    posted = await post_ticket_message(
        bot_token="xoxb-test",
        channel_id="C123",
        text="Ticket besked",
    )

    assert posted.channel_id == "C123"
    assert posted.ts == "171234.000001"


@pytest.mark.asyncio
async def test_post_ticket_message_raises_on_slack_error(monkeypatch: pytest.MonkeyPatch) -> None:
    import star_itsm_api.services.slack as slack_service

    response = _FakeResponse(200, {"ok": False, "error": "channel_not_found"})
    monkeypatch.setattr(
        slack_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(response=response),
    )

    with pytest.raises(SlackApiError, match="channel_not_found"):
        await post_ticket_message(
            bot_token="xoxb-test",
            channel_id="C404",
            text="Ticket besked",
        )


@pytest.mark.asyncio
async def test_get_slack_integration_none() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)
    assert await get_slack_integration(mock_db, organization_id=uuid.uuid4()) is None


@pytest.mark.asyncio
async def test_upsert_slack_integration_creates_new() -> None:
    org_id = uuid.uuid4()
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    integration = await upsert_slack_integration(
        mock_db,
        organization_id=org_id,
        team_id="T1",
        team_name="STAR",
        bot_token="xoxb-new",
    )
    assert integration.organization_id == org_id
    assert integration.slack_team_id == "T1"
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_save_slack_preferences_updates_existing() -> None:
    org_id = uuid.uuid4()
    integration = OrganizationIntegration(
        organization_id=org_id,
        provider="slack",
        enabled=False,
    )
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = integration
    mock_db.execute = AsyncMock(return_value=mock_result)

    updated = await save_slack_preferences(
        mock_db,
        organization_id=org_id,
        enabled=True,
        default_channel_id="C999",
        webhook_url="https://hooks.example/slack",
    )
    assert updated.enabled is True
    assert updated.default_channel_id == "C999"
    assert updated.webhook_url == "https://hooks.example/slack"


@pytest.mark.asyncio
async def test_disconnect_slack_clears_tokens() -> None:
    org_id = uuid.uuid4()
    integration = OrganizationIntegration(
        organization_id=org_id,
        provider="slack",
        enabled=True,
        slack_bot_token="xoxb-old",
        slack_team_id="T1",
        slack_team_name="STAR",
        default_channel_id="C1",
    )
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = integration
    mock_db.execute = AsyncMock(return_value=mock_result)

    await disconnect_slack(mock_db, organization_id=org_id)
    assert integration.enabled is False
    assert integration.slack_bot_token is None
    assert integration.default_channel_id is None
    mock_db.commit.assert_awaited_once()
