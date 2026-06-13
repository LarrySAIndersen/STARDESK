"""Tests for internal ticket-linked chat and personal mentions overview."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.models.team_chat import CHANNEL_TICKET, TeamChatChannel
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.services import ticket_internal_chat as svc


@pytest.mark.asyncio
async def test_invite_user_creates_ticket_channel_and_interested_stakeholder() -> None:
    db = AsyncMock()
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number="INC-0099",
        title="Test sag",
        description="Beskrivelse lang nok til test",
        deleted_at=None,
    )
    inviter = User(
        id=uuid.uuid4(),
        email="agent@example.dk",
        display_name="Agent A",
        role="agent",
        is_active=True,
    )
    invitee_id = uuid.uuid4()
    org_id = uuid.uuid4()

    with (
        patch.object(svc, "_require_staff_user", AsyncMock(return_value=org_id)),
        patch.object(svc, "validate_stakeholder_user_ids", AsyncMock()),
        patch.object(svc, "get_ticket_channel", AsyncMock(return_value=None)),
        patch.object(svc, "upsert_stakeholder", AsyncMock()) as mock_upsert,
        patch.object(svc, "_user_display", AsyncMock(return_value="Agent B")),
    ):
        db.add = MagicMock()
        db.flush = AsyncMock()

        channel = await svc.invite_user_to_ticket_internal_chat(
            db,
            ticket=ticket,
            inviter=inviter,
            invitee_id=invitee_id,
            message="Hej, kan du kigge?",
        )

    assert isinstance(channel, TeamChatChannel)
    assert channel.channel_type == CHANNEL_TICKET
    assert channel.ticket_id == ticket.id
    mock_upsert.assert_awaited()
    assert mock_upsert.await_args.kwargs["role"] == "interested"


@pytest.mark.asyncio
async def test_list_personal_mentions_overview_empty_without_data() -> None:
    db = AsyncMock()
    user = User(
        id=uuid.uuid4(),
        email="agent@example.dk",
        display_name="Agent A",
        role="agent",
        is_active=True,
    )

    mentioned_result = MagicMock()
    mentioned_result.all.return_value = []
    member_result = MagicMock()
    member_result.all.return_value = []

    async def execute_side_effect(stmt):  # noqa: ANN001
        sql = str(stmt)
        if "ticket_stakeholders" in sql:
            return mentioned_result
        return member_result

    db.execute = AsyncMock(side_effect=execute_side_effect)

    overview = await svc.list_personal_mentions_overview(db, user, limit=10)
    assert overview.items == []


@pytest.mark.asyncio
async def test_invite_self_raises_value_error() -> None:
    db = AsyncMock()
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number="INC-0100",
        title="Test",
        description="Lang nok beskrivelse til test",
        deleted_at=None,
    )
    inviter = User(
        id=uuid.uuid4(),
        email="agent@example.dk",
        display_name="Agent A",
        role="agent",
        is_active=True,
    )
    with patch.object(svc, "_require_staff_user", AsyncMock(return_value=uuid.uuid4())):
        with pytest.raises(ValueError, match="self_invite"):
            await svc.invite_user_to_ticket_internal_chat(
                db,
                ticket=ticket,
                inviter=inviter,
                invitee_id=inviter.id,
            )


@pytest.mark.asyncio
async def test_get_ticket_internal_chat_read_empty_channel() -> None:
    db = AsyncMock()
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number="INC-0101",
        title="Test",
        description="Lang nok beskrivelse til test",
        deleted_at=None,
    )
    user = User(
        id=uuid.uuid4(),
        email="agent@example.dk",
        display_name="Agent A",
        role="agent",
        is_active=True,
    )
    with (
        patch.object(svc, "_require_staff_user", AsyncMock(return_value=uuid.uuid4())),
        patch.object(svc, "get_ticket_channel", AsyncMock(return_value=None)),
    ):
        read = await svc.get_ticket_internal_chat_read(db, ticket=ticket, user=user)

    assert read is not None
    assert read.channel_id is None
    assert read.messages == []


@pytest.mark.asyncio
async def test_get_ticket_internal_chat_read_denied_for_non_member() -> None:
    db = AsyncMock()
    ticket_id = uuid.uuid4()
    ticket = Ticket(
        id=ticket_id,
        ticket_number="INC-0102",
        title="Test",
        description="Lang nok beskrivelse til test",
        deleted_at=None,
    )
    user = User(
        id=uuid.uuid4(),
        email="agent@example.dk",
        display_name="Agent A",
        role="agent",
        is_active=True,
    )
    channel = TeamChatChannel(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        name="Intern",
        slug="ticket-abc",
        channel_type=CHANNEL_TICKET,
        ticket_id=ticket_id,
        created_by=uuid.uuid4(),
        is_private=True,
        is_system=False,
    )
    member_result = MagicMock()
    member_result.scalar_one_or_none.return_value = None

    with (
        patch.object(svc, "_require_staff_user", AsyncMock(return_value=uuid.uuid4())),
        patch.object(svc, "get_ticket_channel", AsyncMock(return_value=channel)),
    ):
        db.execute = AsyncMock(return_value=member_result)
        read = await svc.get_ticket_internal_chat_read(db, ticket=ticket, user=user)

    assert read is None


@pytest.mark.asyncio
async def test_sync_mentions_noop_when_empty() -> None:
    db = AsyncMock()
    await svc.sync_mentions_to_internal_chat(
        db,
        ticket_id=uuid.uuid4(),
        author_user_id=uuid.uuid4(),
        mentioned_ids=[],
        body="Hej",
    )
    db.get.assert_not_called()


@pytest.mark.asyncio
async def test_sync_mentions_skips_non_staff_author() -> None:
    db = AsyncMock()
    author_id = uuid.uuid4()
    author = User(
        id=author_id,
        email="borger@example.dk",
        display_name="Borger",
        role="end_user",
        is_active=True,
    )
    db.get = AsyncMock(return_value=author)

    with patch.object(
        svc,
        "invite_user_to_ticket_internal_chat",
        AsyncMock(),
    ) as mock_invite:
        await svc.sync_mentions_to_internal_chat(
            db,
            ticket_id=uuid.uuid4(),
            author_user_id=author_id,
            mentioned_ids=[uuid.uuid4()],
            body="Hej @agent",
        )

    mock_invite.assert_not_awaited()


@pytest.mark.asyncio
async def test_require_staff_user_raises_for_end_user() -> None:
    db = AsyncMock()
    user = User(
        id=uuid.uuid4(),
        email="borger@example.dk",
        display_name="Borger",
        role="end_user",
        is_active=True,
    )
    with pytest.raises(ValueError, match="staff_only"):
        await svc._require_staff_user(db, user)
