"""Unit tests for team chat service helpers and guards."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.models.team_chat import CHANNEL_BOT, CHANNEL_PRIVATE, CHANNEL_PUBLIC
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
async def test_get_or_create_dm_user_not_found() -> None:
    mock_db = AsyncMock()
    with patch(
        "star_itsm_api.services.team_chat.resolve_org_id",
        AsyncMock(return_value=ORG_ID),
    ):
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
        with pytest.raises(ValueError, match="user_not_found"):
            await svc.get_or_create_dm(mock_db, FAKE_AGENT, OTHER_USER_ID)


@pytest.mark.asyncio
async def test_get_or_create_dm_creates_new_channel() -> None:
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()

    other_user = MagicMock()
    other_user.id = OTHER_USER_ID

    channel = MagicMock()
    channel.id = CHANNEL_ID
    channel.name = "Lars"
    channel.slug = "dm-x"
    channel.description = None
    channel.is_private = True
    channel.is_system = False
    channel.channel_type = "dm"

    async def _refresh(obj: object) -> None:
        if hasattr(obj, "id") and getattr(obj, "id", None) is None:
            obj.id = CHANNEL_ID  # type: ignore[attr-defined]

    mock_db.refresh = AsyncMock(side_effect=_refresh)
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: other_user),
            MagicMock(scalar_one_or_none=lambda: None),
        ]
    )

    with patch(
        "star_itsm_api.services.team_chat.resolve_org_id",
        AsyncMock(return_value=ORG_ID),
    ):
        with patch(
            "star_itsm_api.services.team_chat._user_display",
            AsyncMock(return_value="Lars"),
        ):
            result = await svc.get_or_create_dm(mock_db, FAKE_AGENT, OTHER_USER_ID)

    assert result.name == "Lars"
    mock_db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_toggle_reaction_adds_reaction() -> None:
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


@pytest.mark.asyncio
async def test_post_message_channel_not_found() -> None:
    mock_db = AsyncMock()
    with patch(
        "star_itsm_api.services.team_chat.get_channel_for_user",
        AsyncMock(return_value=None),
    ):
        with pytest.raises(ValueError, match="channel_not_found"):
            await svc.post_message(mock_db, CHANNEL_ID, FAKE_AGENT, "Hej")


@pytest.mark.asyncio
async def test_create_channel_private_adds_member() -> None:
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


@pytest.mark.asyncio
async def test_list_messages_returns_reads() -> None:
    mock_db = AsyncMock()
    channel = _channel()
    msg = MagicMock()
    msg.id = MESSAGE_ID
    msg.channel_id = CHANNEL_ID
    msg.user_id = USER_ID
    msg.body = "Hej"
    msg.is_bot = False
    msg.tool_call_meta = None
    msg.created_at = datetime.now(UTC)

    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalars=lambda: MagicMock(all=lambda: [msg])),
            MagicMock(all=lambda: []),
        ]
    )

    with patch(
        "star_itsm_api.services.team_chat.get_channel_for_user",
        AsyncMock(return_value=channel),
    ):
        with patch(
            "star_itsm_api.services.team_chat._user_display",
            AsyncMock(return_value="Agent Test"),
        ):
            messages = await svc.list_messages(mock_db, CHANNEL_ID, FAKE_AGENT)

    assert len(messages) == 1
    assert messages[0].body == "Hej"


@pytest.mark.asyncio
async def test_get_or_create_dm_self_rejected() -> None:
    mock_db = AsyncMock()
    with patch(
        "star_itsm_api.services.team_chat.resolve_org_id",
        AsyncMock(return_value=ORG_ID),
    ):
        with pytest.raises(ValueError, match="self_dm"):
            await svc.get_or_create_dm(mock_db, FAKE_AGENT, USER_ID)

