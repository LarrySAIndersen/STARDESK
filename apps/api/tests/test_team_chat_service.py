"""Unit tests for team chat service helpers and guards."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.models.team_chat import CHANNEL_BOT, CHANNEL_DM, CHANNEL_PRIVATE, CHANNEL_PUBLIC
from star_itsm_api.schemas.team_chat import TeamChatChannelCreate
from star_itsm_api.services import team_chat as svc
from star_itsm_api.services.org_access import IntegrationOrganizationError

ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
OTHER_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
CHANNEL_ID = uuid.UUID("00000000-0000-0000-0000-000000000100")
MESSAGE_ID = uuid.UUID("00000000-0000-0000-0000-000000000101")

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


def _channel(**overrides: object) -> MagicMock:
    ch = MagicMock()
    ch.id = CHANNEL_ID
    ch.name = "general"
    ch.slug = "general"
    ch.description = "desc"
    ch.is_private = False
    ch.is_system = True
    ch.channel_type = CHANNEL_PUBLIC
    for key, value in overrides.items():
        setattr(ch, key, value)
    return ch


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
    channel = _channel()
    with patch(
        "star_itsm_api.services.team_chat.get_channel_for_user",
        AsyncMock(return_value=channel),
    ):
        with pytest.raises(ValueError, match="empty_body"):
            await svc.post_message(mock_db, CHANNEL_ID, FAKE_AGENT, "   ")


@pytest.mark.asyncio
async def test_post_message_public_channel_persists_user_message() -> None:
    mock_db = AsyncMock()
    channel = _channel(channel_type=CHANNEL_PUBLIC)
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()

    async def _refresh(msg: object) -> None:
        msg.id = MESSAGE_ID  # type: ignore[attr-defined]
        msg.channel_id = CHANNEL_ID  # type: ignore[attr-defined]
        msg.user_id = USER_ID  # type: ignore[attr-defined]
        msg.body = "Hej"  # type: ignore[attr-defined]
        msg.is_bot = False  # type: ignore[attr-defined]
        msg.tool_call_meta = None  # type: ignore[attr-defined]
        msg.created_at = datetime.now(UTC)  # type: ignore[attr-defined]

    mock_db.refresh = AsyncMock(side_effect=_refresh)
    mock_db.execute = AsyncMock(return_value=MagicMock(all=lambda: []))

    with patch(
        "star_itsm_api.services.team_chat.get_channel_for_user",
        AsyncMock(return_value=channel),
    ):
        with patch(
            "star_itsm_api.services.team_chat._user_display",
            AsyncMock(return_value="Agent Test"),
        ):
            messages = await svc.post_message(mock_db, CHANNEL_ID, FAKE_AGENT, "Hej")

    assert len(messages) == 1
    assert messages[0].body == "Hej"
    assert messages[0].is_own is True


@pytest.mark.asyncio
async def test_post_message_bot_channel_adds_bot_reply() -> None:
    mock_db = AsyncMock()
    channel = _channel(channel_type=CHANNEL_BOT, slug="help-a-bot")
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(all=lambda: [], first=lambda: None, scalars=lambda: MagicMock(all=lambda: []))
    )

    refresh_count = 0

    async def _refresh(msg: object) -> None:
        nonlocal refresh_count
        refresh_count += 1
        msg.id = MESSAGE_ID if refresh_count == 1 else uuid.uuid4()  # type: ignore[attr-defined]
        msg.channel_id = CHANNEL_ID  # type: ignore[attr-defined]
        msg.user_id = USER_ID if refresh_count == 1 else None  # type: ignore[attr-defined]
        msg.body = "Spørgsmål" if refresh_count == 1 else "Svar fra bot"  # type: ignore[attr-defined]
        msg.is_bot = refresh_count > 1  # type: ignore[attr-defined]
        msg.tool_call_meta = None  # type: ignore[attr-defined]
        msg.created_at = datetime.now(UTC)  # type: ignore[attr-defined]

    mock_db.refresh = AsyncMock(side_effect=_refresh)

    with patch(
        "star_itsm_api.services.team_chat.get_channel_for_user",
        AsyncMock(return_value=channel),
    ):
        with patch(
            "star_itsm_api.services.team_chat._user_display",
            AsyncMock(return_value="Help-a-bot"),
        ):
            with patch(
                "star_itsm_api.services.team_chat.get_smart_mock_response",
                AsyncMock(return_value="Svar fra bot"),
            ):
                messages = await svc.post_message(
                    mock_db, CHANNEL_ID, FAKE_AGENT, "Spørgsmål",
                )

    assert len(messages) == 2
    assert messages[1].is_bot is True


@pytest.mark.asyncio
async def test_list_channels_empty() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: None),
            MagicMock(scalar_one_or_none=lambda: None),
            MagicMock(scalar_one_or_none=lambda: None),
            MagicMock(scalar_one_or_none=lambda: None),
            MagicMock(scalars=lambda: MagicMock(all=lambda: [])),
        ]
    )
    mock_db.commit = AsyncMock()

    with patch(
        "star_itsm_api.services.team_chat.resolve_org_id",
        AsyncMock(return_value=ORG_ID),
    ):
        channels = await svc.list_channels(mock_db, FAKE_AGENT)

    assert channels == []


@pytest.mark.asyncio
async def test_list_staff_returns_rows() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(all=lambda: [(OTHER_USER_ID, "Lars", "lars@example.dk")])
    )
    with patch(
        "star_itsm_api.services.team_chat.resolve_org_id",
        AsyncMock(return_value=ORG_ID),
    ):
        staff = await svc.list_staff(mock_db, FAKE_AGENT)

    assert len(staff) == 1
    assert staff[0].display_name == "Lars"


@pytest.mark.asyncio
async def test_toggle_reaction_unknown_message() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
    with pytest.raises(ValueError, match="message_not_found"):
        await svc.toggle_reaction(mock_db, uuid.uuid4(), FAKE_AGENT, "👍")


@pytest.mark.asyncio
async def test_get_or_create_dm_self_rejected() -> None:
    mock_db = AsyncMock()
    with patch(
        "star_itsm_api.services.team_chat.resolve_org_id",
        AsyncMock(return_value=ORG_ID),
    ):
        with pytest.raises(ValueError, match="self_dm"):
            await svc.get_or_create_dm(mock_db, FAKE_AGENT, USER_ID)


@pytest.mark.asyncio
async def test_ensure_default_channels_creates_missing() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    await svc.ensure_default_channels(mock_db, ORG_ID)
    assert mock_db.add.call_count == len(svc._DEFAULT_CHANNELS)
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_ensure_default_channels_skips_existing() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: CHANNEL_ID))
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    await svc.ensure_default_channels(mock_db, ORG_ID)
    mock_db.add.assert_not_called()


@pytest.mark.asyncio
async def test_get_channel_for_user_private_requires_membership() -> None:
    mock_db = AsyncMock()
    private_channel = _channel(channel_type=CHANNEL_PRIVATE, is_private=True)
    with (
        patch(
            "star_itsm_api.services.team_chat.resolve_org_id",
            AsyncMock(return_value=ORG_ID),
        ),
        patch.object(mock_db, "execute", AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: private_channel),
                MagicMock(scalar_one_or_none=lambda: None),
            ]
        )),
    ):
        result = await svc.get_channel_for_user(mock_db, CHANNEL_ID, FAKE_AGENT)
    assert result is None


@pytest.mark.asyncio
async def test_list_channels_includes_last_message_preview() -> None:
    mock_db = AsyncMock()
    channel = _channel()
    channel.id = CHANNEL_ID
    scalars = MagicMock()
    scalars.all.return_value = [channel]
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: None),
            MagicMock(scalar_one_or_none=lambda: None),
            MagicMock(scalar_one_or_none=lambda: None),
            MagicMock(scalar_one_or_none=lambda: None),
            MagicMock(scalars=lambda: scalars),
            MagicMock(first=lambda: ("Hej team", datetime.now(UTC))),
        ]
    )
    mock_db.commit = AsyncMock()
    with patch(
        "star_itsm_api.services.team_chat.resolve_org_id",
        AsyncMock(return_value=ORG_ID),
    ):
        channels = await svc.list_channels(mock_db, FAKE_AGENT)
    assert len(channels) == 1
    assert channels[0].last_message_preview == "Hej team"


@pytest.mark.asyncio
async def test_toggle_reaction_adds_emoji() -> None:
    mock_db = AsyncMock()
    msg = MagicMock()
    msg.id = MESSAGE_ID
    msg.channel_id = CHANNEL_ID
    channel = _channel()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: msg),
            MagicMock(scalar_one_or_none=lambda: None),
            MagicMock(all=lambda: [(MESSAGE_ID, "👍", 1, True)]),
        ]
    )
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    with patch(
        "star_itsm_api.services.team_chat.get_channel_for_user",
        AsyncMock(return_value=channel),
    ):
        reactions = await svc.toggle_reaction(mock_db, MESSAGE_ID, FAKE_AGENT, "👍")
    assert reactions[0].emoji == "👍"
    assert reactions[0].reacted_by_me is True
    mock_db.add.assert_called_once()


@pytest.mark.asyncio
async def test_toggle_reaction_removes_existing() -> None:
    mock_db = AsyncMock()
    msg = MagicMock()
    msg.id = MESSAGE_ID
    msg.channel_id = CHANNEL_ID
    existing = MagicMock()
    channel = _channel()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: msg),
            MagicMock(scalar_one_or_none=lambda: existing),
            MagicMock(all=lambda: []),
        ]
    )
    mock_db.delete = AsyncMock()
    mock_db.commit = AsyncMock()
    with patch(
        "star_itsm_api.services.team_chat.get_channel_for_user",
        AsyncMock(return_value=channel),
    ):
        reactions = await svc.toggle_reaction(mock_db, MESSAGE_ID, FAKE_AGENT, "👍")
    assert reactions == []
    mock_db.delete.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_or_create_dm_creates_channel() -> None:
    mock_db = AsyncMock()
    other_user = SimpleNamespace(id=OTHER_USER_ID, display_name="Lars")
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: other_user),
            MagicMock(scalar_one_or_none=lambda: None),
        ]
    )
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()

    async def _refresh(channel: object) -> None:
        channel.id = CHANNEL_ID  # type: ignore[attr-defined]
        channel.name = "Lars"  # type: ignore[attr-defined]
        channel.slug = "dm-test"  # type: ignore[attr-defined]
        channel.description = None  # type: ignore[attr-defined]
        channel.is_private = True  # type: ignore[attr-defined]
        channel.is_system = False  # type: ignore[attr-defined]
        channel.channel_type = CHANNEL_DM  # type: ignore[attr-defined]

    mock_db.refresh = AsyncMock(side_effect=_refresh)
    with (
        patch(
            "star_itsm_api.services.team_chat.resolve_org_id",
            AsyncMock(return_value=ORG_ID),
        ),
        patch(
            "star_itsm_api.services.team_chat._user_display",
            AsyncMock(return_value="Lars"),
        ),
    ):
        channel = await svc.get_or_create_dm(mock_db, FAKE_AGENT, OTHER_USER_ID)
    assert channel.id == CHANNEL_ID
    assert channel.channel_type == CHANNEL_DM


@pytest.mark.asyncio
async def test_generate_bot_reply_sets_tool_meta() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(all=lambda: []))
    with patch(
        "star_itsm_api.services.team_chat.get_smart_mock_response",
        AsyncMock(return_value="🔧 tool was used"),
    ):
        text, meta = await svc._generate_bot_reply(mock_db, CHANNEL_ID, FAKE_AGENT, "Hej")
    assert "tool" in text.lower()
    assert meta is not None
    assert meta.get("tools_used") is True


@pytest.mark.asyncio
async def test_list_messages_with_after_filter() -> None:
    mock_db = AsyncMock()
    channel = _channel()
    message = MagicMock()
    message.id = MESSAGE_ID
    message.channel_id = CHANNEL_ID
    message.user_id = USER_ID
    message.body = "Ny besked"
    message.is_bot = False
    message.tool_call_meta = None
    message.created_at = datetime.now(UTC)
    scalars = MagicMock()
    scalars.all.return_value = [message]
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalars=lambda: scalars),
            MagicMock(all=lambda: []),
        ]
    )
    after = datetime.now(UTC)
    with (
        patch(
            "star_itsm_api.services.team_chat.get_channel_for_user",
            AsyncMock(return_value=channel),
        ),
        patch(
            "star_itsm_api.services.team_chat._user_display",
            AsyncMock(return_value="Agent Test"),
        ),
    ):
        reads = await svc.list_messages(mock_db, CHANNEL_ID, FAKE_AGENT, after=after)
    assert len(reads) == 1
    assert reads[0].body == "Ny besked"


@pytest.mark.asyncio
async def test_create_private_channel_adds_member() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()

    async def _refresh(channel: object) -> None:
        channel.id = CHANNEL_ID  # type: ignore[attr-defined]
        channel.name = "Secret"  # type: ignore[attr-defined]
        channel.slug = "secret"  # type: ignore[attr-defined]
        channel.description = None  # type: ignore[attr-defined]
        channel.is_private = True  # type: ignore[attr-defined]
        channel.is_system = False  # type: ignore[attr-defined]
        channel.channel_type = CHANNEL_PRIVATE  # type: ignore[attr-defined]

    mock_db.refresh = AsyncMock(side_effect=_refresh)
    with patch(
        "star_itsm_api.services.team_chat.resolve_org_id",
        AsyncMock(return_value=ORG_ID),
    ):
        created = await svc.create_channel(
            mock_db,
            FAKE_AGENT,
            TeamChatChannelCreate(name="Secret", is_private=True),
        )
    assert created.is_private is True
    assert mock_db.add.call_count >= 2

