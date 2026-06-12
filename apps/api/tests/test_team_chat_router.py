"""Tests for internal team chat workspace API."""

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from star_itsm_api.core.security import get_current_user, get_current_user_session
from star_itsm_api.main import app
from star_itsm_api.schemas.team_chat import TeamChatChannelRead, TeamChatMessageRead

FAKE_AGENT = SimpleNamespace(
    id=uuid.UUID("00000000-0000-0000-0000-000000000002"),
    email="agent@example.dk",
    display_name="Agent Test",
    role="agent",
    is_active=True,
    password_hash=None,
    deleted_at=None,
    must_change_password=False,
    organization_id=uuid.UUID("00000000-0000-0000-0000-000000000010"),
)

FAKE_END_USER = SimpleNamespace(
    id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
    email="sf01@example.dk",
    display_name="Anna Borger",
    role="end_user",
    is_active=True,
    password_hash=None,
    deleted_at=None,
    must_change_password=False,
    organization_id=None,
)

CHANNEL_ID = uuid.UUID("00000000-0000-0000-0000-000000000100")
MESSAGE_ID = uuid.UUID("00000000-0000-0000-0000-000000000101")


@pytest.fixture(autouse=True)
def _use_mock_db(override_db: AsyncMock) -> None:
    pass


@pytest.fixture
async def unauthenticated_client(override_db: AsyncMock) -> AsyncIterator[AsyncClient]:
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_session, None)
    transport = __import__("httpx").ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides[get_current_user] = lambda: FAKE_AGENT
    app.dependency_overrides[get_current_user_session] = lambda: FAKE_AGENT


@pytest.fixture
def as_end_user() -> AsyncIterator[None]:
    app.dependency_overrides[get_current_user] = lambda: FAKE_END_USER
    app.dependency_overrides[get_current_user_session] = lambda: FAKE_END_USER
    yield
    app.dependency_overrides[get_current_user] = lambda: FAKE_AGENT
    app.dependency_overrides[get_current_user_session] = lambda: FAKE_AGENT


@pytest.mark.asyncio
async def test_team_chat_unauthenticated_returns_401(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.get("/api/v1/team-chat/channels")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_team_chat_end_user_forbidden(client: AsyncClient, as_end_user: None) -> None:
    response = await client.get("/api/v1/team-chat/channels")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_channels(client: AsyncClient) -> None:
    sample = [
        TeamChatChannelRead(
            id=CHANNEL_ID,
            name="general",
            slug="general",
            description="Generelle drøftinger",
            is_private=False,
            is_system=True,
            channel_type="public",
        )
    ]
    with patch(
        "star_itsm_api.routers.team_chat.chat_svc.list_channels",
        AsyncMock(return_value=sample),
    ):
        response = await client.get("/api/v1/team-chat/channels")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["slug"] == "general"


@pytest.mark.asyncio
async def test_post_message(client: AsyncClient) -> None:
    now = datetime.now(UTC)
    sample = [
        TeamChatMessageRead(
            id=MESSAGE_ID,
            channel_id=CHANNEL_ID,
            sender_user_id=FAKE_AGENT.id,
            sender_display_name="Agent Test",
            body="Hej team",
            is_bot=False,
            is_own=True,
            created_at=now,
        )
    ]
    with patch(
        "star_itsm_api.routers.team_chat.chat_svc.post_message",
        AsyncMock(return_value=sample),
    ):
        response = await client.post(
            f"/api/v1/team-chat/channels/{CHANNEL_ID}/messages",
            json={"body": "Hej team"},
        )
    assert response.status_code == 201
    assert response.json()["messages"][0]["body"] == "Hej team"
