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
