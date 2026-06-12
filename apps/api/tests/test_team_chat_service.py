"""Unit tests for team chat service helpers and guards."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.schemas.team_chat import TeamChatChannelCreate
from star_itsm_api.services import team_chat as svc
from star_itsm_api.services.org_access import IntegrationOrganizationError

ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
CHANNEL_ID = uuid.UUID("00000000-0000-0000-0000-000000000100")

FAKE_AGENT = SimpleNamespace(
    id=USER_ID,
    email="agent@example.dk",
    display_name="Agent Test",
    role="agent",
    organization_id=ORG_ID,
)

FAKE_END_USER = SimpleNamespace(
    id=uuid.uuid4(),
    email="sf01@example.dk",
    display_name="Anna",
    role="end_user",
    organization_id=None,
)


@pytest.mark.asyncio
async def test_resolve_org_id_rejects_non_staff() -> None:
    mock_db = AsyncMock()
    with pytest.raises(IntegrationOrganizationError):
        await svc.resolve_org_id(mock_db, FAKE_END_USER)


@pytest.mark.asyncio
async def test_resolve_org_id_uses_user_org() -> None:
    mock_db = AsyncMock()
    org_id = await svc.resolve_org_id(mock_db, FAKE_AGENT)
    assert org_id == ORG_ID


@pytest.mark.asyncio
async def test_list_messages_returns_empty_when_channel_missing() -> None:
    mock_db = AsyncMock()
    with patch(
        "star_itsm_api.services.team_chat.get_channel_for_user",
        AsyncMock(return_value=None),
    ):
        result = await svc.list_messages(mock_db, CHANNEL_ID, FAKE_AGENT)
    assert result == []


@pytest.mark.asyncio
async def test_create_channel_public_slug() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()

    async def _refresh(channel: object) -> None:
        channel.id = CHANNEL_ID  # type: ignore[attr-defined]

    mock_db.refresh = AsyncMock(side_effect=_refresh)

    with patch(
        "star_itsm_api.services.team_chat.resolve_org_id",
        AsyncMock(return_value=ORG_ID),
    ):
        created = await svc.create_channel(
            mock_db,
            FAKE_AGENT,
            TeamChatChannelCreate(name="General", is_private=False),
        )

    assert created.slug == "general"
    mock_db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_post_message_raises_on_empty_body() -> None:
    mock_db = AsyncMock()
    channel = MagicMock(channel_type="public", slug="general")
    with patch(
        "star_itsm_api.services.team_chat.get_channel_for_user",
        AsyncMock(return_value=channel),
    ):
        with pytest.raises(ValueError, match="empty_body"):
            await svc.post_message(mock_db, CHANNEL_ID, FAKE_AGENT, "   ")


@pytest.mark.asyncio
async def test_toggle_reaction_unknown_message() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
    with pytest.raises(ValueError, match="message_not_found"):
        await svc.toggle_reaction(mock_db, uuid.uuid4(), FAKE_AGENT, "👍")
