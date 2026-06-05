"""Unit tests for SF chat service helpers and database operations."""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.models.sf_chat_message import SfChatMessage
from star_itsm_api.models.sf_chat_presence import SfChatPresence
from star_itsm_api.models.sf_chat_session import (
    SESSION_ACTIVE,
    SESSION_CLOSED,
    SESSION_REJECTED_QUEUE,
    SESSION_WAITING,
    SfChatSession,
)
from star_itsm_api.models.user import User
from star_itsm_api.schemas.sf_chat import SfChatMessageRead
from star_itsm_api.services import sf_chat
from star_itsm_api.services.sf_chat import (
    MSG_CHAT_CLOSED,
    MSG_QUEUE_REJECTED,
    _estimated_wait_minutes,
    format_sf_chat_transcript_da,
)
from star_itsm_api.services.sf_chat_bot import mock_bot_reply


def test_chat_closed_message_danish() -> None:
    assert "ikke åben" in MSG_CHAT_CLOSED.lower() or "åben" in MSG_CHAT_CLOSED


def test_queue_rejected_message_danish() -> None:
    assert "kø" in MSG_QUEUE_REJECTED.lower()
    assert "utilgængelig" in MSG_QUEUE_REJECTED.lower()


def test_format_sf_chat_transcript_da() -> None:
    sid = uuid.uuid4()
    mid = uuid.uuid4()
    dt = datetime(2026, 1, 2, 15, 30, tzinfo=UTC)
    msgs = [
        SfChatMessageRead(
            id=mid,
            session_id=sid,
            sender_user_id=None,
            sender_display_name="System",
            body="Kunden har forladt chatten.",
            created_at=dt,
            is_own=False,
            is_system=True,
        ),
    ]
    text = format_sf_chat_transcript_da(msgs)
    assert "System" in text
    assert "Kunden har forladt chatten." in text
    assert "2026-01-02" in text


def test_estimated_wait_minutes() -> None:
    assert _estimated_wait_minutes(0, 2) is None
    assert _estimated_wait_minutes(3, 0) == 12
    assert _estimated_wait_minutes(2, 2) == 3


def test_mock_bot_reply_mine_sager_da() -> None:
    reply = mock_bot_reply("vis mine sager", [], display_name="Anna")
    assert "ingen egne sager" in reply.lower() or "sag" in reply.lower()


# --- Database / Async Tests ---


@pytest.mark.asyncio
async def test_get_sf_team_id_found() -> None:
    team_id = uuid.uuid4()
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = team_id
    mock_db.execute = AsyncMock(return_value=mock_result)

    result = await sf_chat.get_sf_team_id(mock_db)
    assert result == team_id


@pytest.mark.asyncio
async def test_get_sf_team_id_not_found() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    result = await sf_chat.get_sf_team_id(mock_db)
    assert result is None


@pytest.mark.asyncio
async def test_is_sf_team_member_true() -> None:
    team_id = uuid.uuid4()
    user_id = uuid.uuid4()
    mock_db = AsyncMock()

    # First query: get_sf_team_id
    mock_result_team = MagicMock()
    mock_result_team.scalar_one_or_none.return_value = team_id

    # Second query: TeamMember check
    mock_result_member = MagicMock()
    mock_result_member.scalar_one_or_none.return_value = team_id

    mock_db.execute = AsyncMock(side_effect=[mock_result_team, mock_result_member])

    result = await sf_chat.is_sf_team_member(mock_db, user_id)
    assert result is True


@pytest.mark.asyncio
async def test_is_sf_team_member_false_no_team() -> None:
    user_id = uuid.uuid4()
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    result = await sf_chat.is_sf_team_member(mock_db, user_id)
    assert result is False


@pytest.mark.asyncio
async def test_is_sf_team_member_false_not_member() -> None:
    team_id = uuid.uuid4()
    user_id = uuid.uuid4()
    mock_db = AsyncMock()

    mock_result_team = MagicMock()
    mock_result_team.scalar_one_or_none.return_value = team_id

    mock_result_member = MagicMock()
    mock_result_member.scalar_one_or_none.return_value = None

    mock_db.execute = AsyncMock(side_effect=[mock_result_team, mock_result_member])

    result = await sf_chat.is_sf_team_member(mock_db, user_id)
    assert result is False


@pytest.mark.asyncio
async def test_agent_presence_is_fresh_none() -> None:
    agent_id = uuid.uuid4()
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)

    result = await sf_chat._agent_presence_is_fresh(mock_db, agent_id)
    assert result is False


@pytest.mark.asyncio
async def test_agent_presence_is_fresh_offline() -> None:
    agent_id = uuid.uuid4()
    mock_db = AsyncMock()
    presence = SfChatPresence(user_id=agent_id, is_online=False)
    mock_db.get = AsyncMock(return_value=presence)

    result = await sf_chat._agent_presence_is_fresh(mock_db, agent_id)
    assert result is False


@pytest.mark.asyncio
async def test_agent_presence_is_fresh_stale() -> None:
    agent_id = uuid.uuid4()
    mock_db = AsyncMock()
    stale_time = datetime.now(UTC) - timedelta(seconds=120)
    presence = SfChatPresence(user_id=agent_id, is_online=True, last_seen_at=stale_time)
    mock_db.get = AsyncMock(return_value=presence)

    result = await sf_chat._agent_presence_is_fresh(mock_db, agent_id)
    assert result is False


@pytest.mark.asyncio
async def test_agent_presence_is_fresh_true() -> None:
    agent_id = uuid.uuid4()
    mock_db = AsyncMock()
    fresh_time = datetime.now(UTC) - timedelta(seconds=10)
    presence = SfChatPresence(user_id=agent_id, is_online=True, last_seen_at=fresh_time)
    mock_db.get = AsyncMock(return_value=presence)

    result = await sf_chat._agent_presence_is_fresh(mock_db, agent_id)
    assert result is True


@pytest.mark.asyncio
async def test_maybe_reconcile_stale_agent_sessions_no_sessions() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)

    await sf_chat.maybe_reconcile_stale_agent_sessions(mock_db)
    mock_db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_maybe_reconcile_stale_agent_sessions_fresh_agent() -> None:
    agent_id = uuid.uuid4()
    session = SfChatSession(id=uuid.uuid4(), status=SESSION_ACTIVE, assigned_agent_id=agent_id)
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [session]
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Mock _agent_presence_is_fresh to return True
    fresh_time = datetime.now(UTC) - timedelta(seconds=10)
    presence = SfChatPresence(user_id=agent_id, is_online=True, last_seen_at=fresh_time)
    mock_db.get = AsyncMock(return_value=presence)

    await sf_chat.maybe_reconcile_stale_agent_sessions(mock_db)
    mock_db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_maybe_reconcile_stale_agent_sessions_stale_agent() -> None:
    agent_id = uuid.uuid4()
    session = SfChatSession(id=uuid.uuid4(), status=SESSION_ACTIVE, assigned_agent_id=agent_id)
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [session]
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Mock SfChatPresence to be stale (or None)
    presence = SfChatPresence(user_id=agent_id, is_online=True, last_seen_at=datetime.now(UTC) - timedelta(seconds=200), active_session_id=session.id)
    mock_db.get = AsyncMock(side_effect=[presence, presence]) # Once in _agent_presence_is_fresh, once in reconciliation

    await sf_chat.maybe_reconcile_stale_agent_sessions(mock_db)
    assert session.status == SESSION_CLOSED
    assert presence.active_session_id is None
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_fresh_online_agent_ids_no_team() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    result = await sf_chat._fresh_online_agent_ids(mock_db)
    assert result == []


@pytest.mark.asyncio
async def test_fresh_online_agent_ids_success() -> None:
    team_id = uuid.uuid4()
    agent_id = uuid.uuid4()
    mock_db = AsyncMock()

    # First query: get_sf_team_id
    mock_result_team = MagicMock()
    mock_result_team.scalar_one_or_none.return_value = team_id

    # Second query: fresh online agents
    mock_result_agents = MagicMock()
    mock_result_agents.scalars.return_value.all.return_value = [agent_id]

    mock_db.execute = AsyncMock(side_effect=[mock_result_team, mock_result_agents])

    result = await sf_chat._fresh_online_agent_ids(mock_db)
    assert result == [agent_id]


@pytest.mark.asyncio
async def test_count_waiting_sessions() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = 5
    mock_db.execute = AsyncMock(return_value=mock_result)

    result = await sf_chat.count_waiting_sessions(mock_db)
    assert result == 5


def test_wait_seconds_for_session() -> None:
    # Not waiting
    session_closed = SfChatSession(status=SESSION_CLOSED, created_at=datetime.now(UTC))
    assert sf_chat._wait_seconds_for_session(session_closed) is None

    # Waiting
    now = datetime(2026, 6, 10, 12, 0, tzinfo=UTC)
    created = datetime(2026, 6, 10, 11, 59, tzinfo=UTC)
    session_waiting = SfChatSession(status=SESSION_WAITING, created_at=created)
    assert sf_chat._wait_seconds_for_session(session_waiting, now=now) == 60


@pytest.mark.asyncio
async def test_get_chat_status_open() -> None:
    mock_db = AsyncMock()

    # Mock maybe_reconcile_stale_agent_sessions -> execute for SfChatSession list
    mock_sessions_result = MagicMock()
    mock_sessions_result.scalars.return_value.all.return_value = []

    # Mock _fresh_online_agent_ids -> get_sf_team_id
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = uuid.uuid4()

    # Mock _fresh_online_agent_ids -> agents list
    mock_agents_result = MagicMock()
    mock_agents_result.scalars.return_value.all.return_value = [uuid.uuid4()]

    # Mock count_waiting_sessions
    mock_waiting_result = MagicMock()
    mock_waiting_result.scalar_one.return_value = 2

    mock_db.execute = AsyncMock(side_effect=[
        mock_sessions_result,
        mock_team_result,
        mock_agents_result,
        mock_waiting_result,
    ])

    status = await sf_chat.get_chat_status(mock_db)
    assert status.open is True
    assert status.available_agents == 1
    assert status.waiting_sessions == 2
    assert status.estimated_wait_minutes == 6


@pytest.mark.asyncio
async def test_get_chat_status_no_agents_but_waiting() -> None:
    mock_db = AsyncMock()

    # Mock maybe_reconcile_stale_agent_sessions
    mock_sessions_result = MagicMock()
    mock_sessions_result.scalars.return_value.all.return_value = []

    # Mock _fresh_online_agent_ids -> get_sf_team_id
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = uuid.uuid4()

    # Mock _fresh_online_agent_ids -> agents list (empty)
    mock_agents_result = MagicMock()
    mock_agents_result.scalars.return_value.all.return_value = []

    # Mock count_waiting_sessions
    mock_waiting_result = MagicMock()
    mock_waiting_result.scalar_one.return_value = 1

    mock_db.execute = AsyncMock(side_effect=[
        mock_sessions_result,
        mock_team_result,
        mock_agents_result,
        mock_waiting_result,
    ])

    status = await sf_chat.get_chat_status(mock_db)
    assert status.open is True
    assert status.available_agents == 0
    assert status.waiting_sessions == 1
    assert "Ingen agent er logget på" in status.message


@pytest.mark.asyncio
async def test_user_display_found_display_name() -> None:
    user_id = uuid.uuid4()
    mock_db = AsyncMock()
    user = User(id=user_id, display_name="John Doe", email="john@example.com")
    mock_db.get = AsyncMock(return_value=user)

    result = await sf_chat._user_display(mock_db, user_id)
    assert result == "John Doe"


@pytest.mark.asyncio
async def test_user_display_found_email() -> None:
    user_id = uuid.uuid4()
    mock_db = AsyncMock()
    user = User(id=user_id, display_name=None, email="john@example.com")
    mock_db.get = AsyncMock(return_value=user)

    result = await sf_chat._user_display(mock_db, user_id)
    assert result == "john@example.com"


@pytest.mark.asyncio
async def test_user_display_not_found() -> None:
    user_id = uuid.uuid4()
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)

    result = await sf_chat._user_display(mock_db, user_id)
    assert result == "Ukendt"


@pytest.mark.asyncio
async def test_get_or_create_customer_session_existing() -> None:
    customer = User(id=uuid.uuid4(), email="cust@example.com")
    session = SfChatSession(id=uuid.uuid4(), customer_user_id=customer.id, status=SESSION_WAITING, created_at=datetime.now(UTC))
    mock_db = AsyncMock()

    # Mock get_chat_status queries
    mock_sessions_result = MagicMock()
    mock_sessions_result.scalars.return_value.all.return_value = []
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = uuid.uuid4()
    mock_agents_result = MagicMock()
    mock_agents_result.scalars.return_value.all.return_value = []
    mock_waiting_result = MagicMock()
    mock_waiting_result.scalar_one.return_value = 1

    # Mock existing session query
    mock_existing_result = MagicMock()
    mock_existing_result.scalar_one_or_none.return_value = session

    # Mock _message_reads query
    mock_messages_result = MagicMock()
    mock_messages_result.all.return_value = []

    mock_db.execute = AsyncMock(side_effect=[
        mock_sessions_result,
        mock_team_result,
        mock_agents_result,
        mock_waiting_result,
        mock_existing_result,
        mock_messages_result,
    ])

    res_session, messages, status, queue_msg = await sf_chat.get_or_create_customer_session(mock_db, customer)
    assert res_session.id == session.id
    assert queue_msg is None


@pytest.mark.asyncio
async def test_get_or_create_customer_session_closed() -> None:
    customer = User(id=uuid.uuid4(), email="cust@example.com")
    mock_db = AsyncMock()

    # Mock get_chat_status queries -> closed (no agents, no waiting)
    mock_sessions_result = MagicMock()
    mock_sessions_result.scalars.return_value.all.return_value = []
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = uuid.uuid4()
    mock_agents_result = MagicMock()
    mock_agents_result.scalars.return_value.all.return_value = []
    mock_waiting_result = MagicMock()
    mock_waiting_result.scalar_one.return_value = 0

    # Mock existing session query -> None
    mock_existing_result = MagicMock()
    mock_existing_result.scalar_one_or_none.return_value = None

    mock_db.execute = AsyncMock(side_effect=[
        mock_sessions_result,
        mock_team_result,
        mock_agents_result,
        mock_waiting_result,
        mock_existing_result,
    ])

    res_session, messages, status, queue_msg = await sf_chat.get_or_create_customer_session(mock_db, customer)
    assert res_session.status == SESSION_CLOSED
    assert queue_msg == MSG_CHAT_CLOSED


@pytest.mark.asyncio
async def test_get_or_create_customer_session_queue_full() -> None:
    customer = User(id=uuid.uuid4(), email="cust@example.com")
    mock_db = AsyncMock()

    # Mock get_chat_status queries -> open (agents available)
    mock_sessions_result = MagicMock()
    mock_sessions_result.scalars.return_value.all.return_value = []
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = uuid.uuid4()
    mock_agents_result = MagicMock()
    mock_agents_result.scalars.return_value.all.return_value = [uuid.uuid4()]
    mock_waiting_result = MagicMock()
    mock_waiting_result.scalar_one.return_value = 0

    # Mock existing session query -> None
    mock_existing_result = MagicMock()
    mock_existing_result.scalar_one_or_none.return_value = None

    # Mock count_waiting_sessions in get_or_create -> returns 10 (>= MAX_WAITING_QUEUE)
    mock_count_waiting_result = MagicMock()
    mock_count_waiting_result.scalar_one.return_value = 10

    mock_db.execute = AsyncMock(side_effect=[
        mock_sessions_result,
        mock_team_result,
        mock_agents_result,
        mock_waiting_result,
        mock_existing_result,
        mock_count_waiting_result,
    ])
    mock_db.flush = AsyncMock()

    res_session, messages, status, queue_msg = await sf_chat.get_or_create_customer_session(mock_db, customer)
    assert res_session.status == SESSION_REJECTED_QUEUE
    assert queue_msg == MSG_QUEUE_REJECTED


@pytest.mark.asyncio
async def test_get_or_create_customer_session_create_new() -> None:
    customer = User(id=uuid.uuid4(), email="cust@example.com")
    mock_db = AsyncMock()

    # Mock get_chat_status queries -> open
    mock_sessions_result = MagicMock()
    mock_sessions_result.scalars.return_value.all.return_value = []
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = uuid.uuid4()
    mock_agents_result = MagicMock()
    mock_agents_result.scalars.return_value.all.return_value = [uuid.uuid4()]
    mock_waiting_result = MagicMock()
    mock_waiting_result.scalar_one.return_value = 0

    # Mock existing session query -> None
    mock_existing_result = MagicMock()
    mock_existing_result.scalar_one_or_none.return_value = None

    # Mock count_waiting_sessions in get_or_create -> returns 2
    mock_count_waiting_result = MagicMock()
    mock_count_waiting_result.scalar_one.return_value = 2

    # Mock _pick_agent in _try_assign_agent -> get_sf_team_id
    mock_pick_team_result = MagicMock()
    mock_pick_team_result.scalar_one_or_none.return_value = uuid.uuid4()

    # Mock _pick_agent in _try_assign_agent -> agents list (empty, so no agent assigned)
    mock_pick_agents_result = MagicMock()
    mock_pick_agents_result.scalars.return_value.all.return_value = []

    # Mock _message_reads query
    mock_messages_result = MagicMock()
    mock_messages_result.all.return_value = []

    mock_db.execute = AsyncMock(side_effect=[
        mock_sessions_result,
        mock_team_result,
        mock_agents_result,
        mock_waiting_result,
        mock_existing_result,
        mock_count_waiting_result,
        mock_pick_team_result,
        mock_pick_agents_result,
        mock_messages_result,
    ])
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    res_session, messages, status, queue_msg = await sf_chat.get_or_create_customer_session(mock_db, customer)
    assert res_session.status == SESSION_WAITING
    assert queue_msg is None


@pytest.mark.asyncio
async def test_record_customer_typing_wrong_customer() -> None:
    session_id = uuid.uuid4()
    customer_id = uuid.uuid4()
    session = SfChatSession(id=session_id, customer_user_id=uuid.uuid4(), status=SESSION_ACTIVE)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    await sf_chat.record_customer_typing(mock_db, session_id, customer_id)
    mock_db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_record_customer_typing_wrong_status() -> None:
    session_id = uuid.uuid4()
    customer_id = uuid.uuid4()
    session = SfChatSession(id=session_id, customer_user_id=customer_id, status=SESSION_CLOSED)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    await sf_chat.record_customer_typing(mock_db, session_id, customer_id)
    mock_db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_record_customer_typing_success() -> None:
    session_id = uuid.uuid4()
    customer_id = uuid.uuid4()
    session = SfChatSession(id=session_id, customer_user_id=customer_id, status=SESSION_ACTIVE)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)
    mock_db.commit = AsyncMock()

    await sf_chat.record_customer_typing(mock_db, session_id, customer_id)
    assert session.customer_last_typing_at is not None
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_abandon_customer_session_wrong_customer() -> None:
    session_id = uuid.uuid4()
    customer_id = uuid.uuid4()
    session = SfChatSession(id=session_id, customer_user_id=uuid.uuid4(), status=SESSION_ACTIVE)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    result = await sf_chat.abandon_customer_session(mock_db, session_id, customer_id)
    assert result is None


@pytest.mark.asyncio
async def test_abandon_customer_session_wrong_status() -> None:
    session_id = uuid.uuid4()
    customer_id = uuid.uuid4()
    session = SfChatSession(id=session_id, customer_user_id=customer_id, status=SESSION_CLOSED)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    result = await sf_chat.abandon_customer_session(mock_db, session_id, customer_id)
    assert result == session


@pytest.mark.asyncio
async def test_abandon_customer_session_success_no_messages_but_typed() -> None:
    session_id = uuid.uuid4()
    customer_id = uuid.uuid4()
    session = SfChatSession(
        id=session_id,
        customer_user_id=customer_id,
        status=SESSION_WAITING,
        customer_last_typing_at=datetime.now(UTC),
    )
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    # Mock count messages query -> returns 0
    mock_count_result = MagicMock()
    mock_count_result.scalar_one.return_value = 0
    mock_db.execute = AsyncMock(return_value=mock_count_result)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    result = await sf_chat.abandon_customer_session(mock_db, session_id, customer_id)
    assert result.status == SESSION_REJECTED_QUEUE
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_abandon_customer_session_success_with_messages() -> None:
    session_id = uuid.uuid4()
    customer_id = uuid.uuid4()
    session = SfChatSession(
        id=session_id,
        customer_user_id=customer_id,
        status=SESSION_WAITING,
        customer_last_typing_at=None,
    )
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    # Mock count messages query -> returns 2
    mock_count_result = MagicMock()
    mock_count_result.scalar_one.return_value = 2
    mock_db.execute = AsyncMock(return_value=mock_count_result)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    result = await sf_chat.abandon_customer_session(mock_db, session_id, customer_id)
    assert result.status == SESSION_CLOSED
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_add_message_session_not_found() -> None:
    session_id = uuid.uuid4()
    sender = User(id=uuid.uuid4())
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)

    with pytest.raises(ValueError, match="session_not_found"):
        await sf_chat.add_message(mock_db, session_id, sender, "Hello")


@pytest.mark.asyncio
async def test_add_message_customer_rejected_queue() -> None:
    session_id = uuid.uuid4()
    sender = User(id=uuid.uuid4())
    session = SfChatSession(id=session_id, customer_user_id=sender.id, status=SESSION_REJECTED_QUEUE)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    # Mock is_sf_team_member check
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_team_result)

    with pytest.raises(ValueError, match="queue_rejected"):
        await sf_chat.add_message(mock_db, session_id, sender, "Hello")


@pytest.mark.asyncio
async def test_add_message_customer_closed() -> None:
    session_id = uuid.uuid4()
    sender = User(id=uuid.uuid4())
    session = SfChatSession(id=session_id, customer_user_id=sender.id, status=SESSION_CLOSED)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    # Mock is_sf_team_member check
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_team_result)

    with pytest.raises(ValueError, match="session_closed"):
        await sf_chat.add_message(mock_db, session_id, sender, "Hello")


@pytest.mark.asyncio
async def test_add_message_customer_waiting_closes_if_no_agents() -> None:
    session_id = uuid.uuid4()
    sender = User(id=uuid.uuid4())
    session = SfChatSession(id=session_id, customer_user_id=sender.id, status=SESSION_WAITING, bot_assistant_active=False)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    # Mock is_sf_team_member check -> False
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None

    # Mock _try_assign_agent -> get_sf_team_id -> None
    mock_pick_team_result = MagicMock()
    mock_pick_team_result.scalar_one_or_none.return_value = None

    # Mock _fresh_online_agent_ids -> get_sf_team_id -> None
    mock_fresh_team_result = MagicMock()
    mock_fresh_team_result.scalar_one_or_none.return_value = None

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_pick_team_result,
        mock_fresh_team_result,
    ])
    mock_commit = AsyncMock()
    mock_db.commit = mock_commit

    with pytest.raises(ValueError, match="chat_closed"):
        await sf_chat.add_message(mock_db, session_id, sender, "Hello")
    assert session.status == SESSION_REJECTED_QUEUE


@pytest.mark.asyncio
async def test_add_message_forbidden_sender() -> None:
    session_id = uuid.uuid4()
    sender = User(id=uuid.uuid4())
    session = SfChatSession(id=session_id, customer_user_id=uuid.uuid4(), assigned_agent_id=uuid.uuid4(), status=SESSION_ACTIVE)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    # Mock is_sf_team_member check -> False
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_team_result)

    with pytest.raises(ValueError, match="forbidden"):
        await sf_chat.add_message(mock_db, session_id, sender, "Hello")


@pytest.mark.asyncio
async def test_add_message_sf_agent_waiting_assigns() -> None:
    session_id = uuid.uuid4()
    sender = User(id=uuid.uuid4())
    session = SfChatSession(id=session_id, customer_user_id=uuid.uuid4(), status=SESSION_WAITING)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=[session, None]) # Once for session, once for presence

    # Mock is_sf_team_member check -> True (returns team_id)
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    msg = await sf_chat.add_message(mock_db, session_id, sender, "Hello")
    assert session.assigned_agent_id == sender.id
    assert session.status == SESSION_ACTIVE
    assert session.bot_assistant_active is False
    assert msg.body == "Hello"


@pytest.mark.asyncio
@patch("star_itsm_api.services.sf_chat.build_bot_reply_for_customer")
async def test_add_message_bot_assistant_reply(mock_build_bot_reply) -> None:
    session_id = uuid.uuid4()
    sender = User(id=uuid.uuid4())
    session = SfChatSession(id=session_id, customer_user_id=sender.id, status=SESSION_WAITING, bot_assistant_active=True)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=[session, sender]) # Once for session, once for customer in bot reply

    # Mock is_sf_team_member check -> False
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_team_result)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    mock_build_bot_reply.return_value = "Bot Reply"

    msg = await sf_chat.add_message(mock_db, session_id, sender, "Hello")
    assert msg.body == "Hello"
    mock_build_bot_reply.assert_called_once()


@pytest.mark.asyncio
async def test_get_presence_none() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)

    # Mock is_sf_team_member check -> False
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_team_result)

    presence = await sf_chat.get_presence(mock_db, user)
    assert presence.is_online is False
    assert presence.is_sf_member is False


@pytest.mark.asyncio
async def test_get_presence_found() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()
    row = SfChatPresence(user_id=user.id, is_online=True, active_session_id=uuid.uuid4())
    mock_db.get = AsyncMock(return_value=row)

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id
    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])

    presence = await sf_chat.get_presence(mock_db, user)
    assert presence.is_online is True
    assert presence.is_sf_member is True
    assert presence.active_session_id == row.active_session_id


@pytest.mark.asyncio
async def test_set_presence_online_not_sf_member() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member check -> False
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_team_result)

    with pytest.raises(ValueError, match="not_sf_member"):
        await sf_chat.set_presence_online(mock_db, user, online=True, force=False)


@pytest.mark.asyncio
async def test_set_presence_online_logout_blocked() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    # Mock logout_check -> returns can_logout=False
    # We need to mock the queries inside logout_check:
    # 1. SfChatPresence get
    # 2. active_count
    # 3. waiting_count
    # 4. typing_waiting
    row = SfChatPresence(user_id=user.id, is_online=True)
    mock_db.get = AsyncMock(return_value=row)

    mock_active_result = MagicMock()
    mock_active_result.scalar_one.return_value = 1
    mock_waiting_result = MagicMock()
    mock_waiting_result.scalar_one.return_value = 0
    mock_typing_result = MagicMock()
    mock_typing_result.scalar_one.return_value = 0

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_member_result,
        # Inside logout_check:
        mock_team_result, # is_sf_team_member check inside logout_check
        mock_member_result,
        mock_active_result,
        mock_waiting_result,
        mock_typing_result,
    ])

    with pytest.raises(ValueError, match="logout_blocked"):
        await sf_chat.set_presence_online(mock_db, user, online=False, force=False)


@pytest.mark.asyncio
async def test_set_presence_online_success() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    row = SfChatPresence(user_id=user.id, is_online=False)
    mock_db.get = AsyncMock(return_value=row)

    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    presence = await sf_chat.set_presence_online(mock_db, user, online=True, force=False)
    assert presence.is_online is True
    assert row.is_online is True
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_heartbeat_presence() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    row = SfChatPresence(user_id=user.id, is_online=True)
    mock_db.get = AsyncMock(return_value=row)

    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])
    mock_db.commit = AsyncMock()

    await sf_chat.heartbeat_presence(mock_db, user)
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_logout_check_not_sf_member() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member check -> False
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_team_result)

    check = await sf_chat.logout_check(mock_db, user)
    assert check.can_logout is True


@pytest.mark.asyncio
async def test_logout_check_offline() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    row = SfChatPresence(user_id=user.id, is_online=False)
    mock_db.get = AsyncMock(return_value=row)

    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])

    check = await sf_chat.logout_check(mock_db, user)
    assert check.can_logout is True


@pytest.mark.asyncio
async def test_build_agent_inbox_not_sf_member() -> None:
    agent = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member check -> False
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_team_result)

    inbox = await sf_chat.build_agent_inbox(mock_db, agent)
    assert inbox.online is False
    assert len(inbox.items) == 0


@pytest.mark.asyncio
async def test_build_agent_inbox_success() -> None:
    agent = User(id=uuid.uuid4(), display_name="Agent Anna", email="anna@example.com")
    customer = User(id=uuid.uuid4(), display_name="Cust", email="cust@example.com")
    session = SfChatSession(
        id=uuid.uuid4(),
        customer_user_id=customer.id,
        status=SESSION_ACTIVE,
        assigned_agent_id=agent.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    mock_db = AsyncMock()

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    # Mock maybe_reconcile_stale_agent_sessions -> execute SfChatSession list
    mock_sessions_result = MagicMock()
    mock_sessions_result.scalars.return_value.all.return_value = []

    # Mock SfChatPresence get
    presence = SfChatPresence(user_id=agent.id, is_online=True)
    mock_db.get = AsyncMock(side_effect=[presence, None]) # Once for presence, once for _user_display agent

    # Mock build_agent_inbox rows query
    mock_rows_result = MagicMock()
    mock_rows_result.all.return_value = [(session, customer)]

    # Mock count_waiting_sessions
    mock_waiting_result = MagicMock()
    mock_waiting_result.scalar_one.return_value = 0

    # Mock _fresh_online_agent_ids -> get_sf_team_id
    mock_fresh_team_result = MagicMock()
    mock_fresh_team_result.scalar_one_or_none.return_value = team_id

    # Mock _fresh_online_agent_ids -> agents list
    mock_fresh_agents_result = MagicMock()
    mock_fresh_agents_result.scalars.return_value.all.return_value = [agent.id]

    # Mock last message query
    last_msg = SfChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        sender_user_id=customer.id,
        body="Hello Anna",
        created_at=datetime.now(UTC),
    )
    mock_last_msg_result = MagicMock()
    mock_last_msg_result.scalar_one_or_none.return_value = last_msg

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_member_result,
        mock_sessions_result,
        mock_rows_result,
        mock_waiting_result,
        mock_fresh_team_result,
        mock_fresh_agents_result,
        mock_last_msg_result,
    ])

    inbox = await sf_chat.build_agent_inbox(mock_db, agent)
    assert inbox.online is True
    assert len(inbox.items) == 1
    assert inbox.items[0].customer_display_name == "Cust"
    assert inbox.items[0].last_message_preview == "Hello Anna"


@pytest.mark.asyncio
async def test_start_bot_assistant_for_session_not_sf_member() -> None:
    agent = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member check -> False
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_team_result)

    with pytest.raises(ValueError, match="not_sf_member"):
        await sf_chat.start_bot_assistant_for_session(mock_db, session_id=uuid.uuid4(), agent=agent)


@pytest.mark.asyncio
async def test_start_bot_assistant_for_session_success() -> None:
    agent = User(id=uuid.uuid4())
    session = SfChatSession(id=uuid.uuid4(), status=SESSION_WAITING, bot_assistant_active=False, created_at=datetime.now(UTC), updated_at=datetime.now(UTC))
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id
    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    res = await sf_chat.start_bot_assistant_for_session(mock_db, session_id=session.id, agent=agent)
    assert res.bot_assistant_active is True
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_session_for_user_customer() -> None:
    user = User(id=uuid.uuid4())
    session = SfChatSession(id=uuid.uuid4(), customer_user_id=user.id)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    result = await sf_chat.session_for_user(mock_db, session.id, user)
    assert result == session


@pytest.mark.asyncio
async def test_session_for_user_sf_member() -> None:
    user = User(id=uuid.uuid4())
    session = SfChatSession(id=uuid.uuid4(), customer_user_id=uuid.uuid4(), status=SESSION_WAITING)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id
    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])

    result = await sf_chat.session_for_user(mock_db, session.id, user)
    assert result == session


@pytest.mark.asyncio
@patch("star_itsm_api.services.sf_chat.apply_routing")
@patch("star_itsm_api.services.sf_chat.apply_sla_to_ticket")
@patch("star_itsm_api.services.sf_chat.generate_ticket_number")
@patch("star_itsm_api.services.sf_chat.resolve_create_security_flag")
async def test_create_ticket_from_sf_chat_session_success(
    mock_resolve_security,
    mock_gen_number,
    mock_apply_sla,
    mock_apply_routing,
) -> None:
    agent = User(id=uuid.uuid4(), organization_id=uuid.uuid4())
    customer = User(id=uuid.uuid4(), display_name="John Cust", email="john@example.com")
    session = SfChatSession(id=uuid.uuid4(), customer_user_id=customer.id, status=SESSION_CLOSED, assigned_agent_id=agent.id)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=[session, customer])

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    # Mock _message_reads query
    mock_messages_result = MagicMock()
    mock_messages_result.all.return_value = []

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_member_result,
        mock_messages_result,
    ])
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    # Mock patches
    mock_resolve_security.return_value = False
    mock_gen_number.return_value = "INC-12345"
    
    routing_mock = MagicMock()
    routing_mock.priority = "medium"
    routing_mock.assigned_team_id = uuid.uuid4()
    routing_mock.assigned_user_id = None
    mock_apply_routing.return_value = routing_mock

    ticket = await sf_chat.create_ticket_from_sf_chat_session(
        mock_db,
        session_id=session.id,
        agent=agent,
        title="Custom Title",
    )

    assert ticket.title == "Custom Title"
    assert ticket.ticket_number == "INC-12345"
    mock_db.commit.assert_awaited_once()


# --- Additional Coverage Tests ---


def test_wait_seconds_for_session_naive_datetime() -> None:
    # Test naive datetime conversion
    created = datetime(2026, 6, 10, 11, 59, 0)  # Naive datetime
    session = SfChatSession(status=SESSION_WAITING, created_at=created)
    now = datetime(2026, 6, 10, 12, 0, 0, tzinfo=UTC)
    res = sf_chat._wait_seconds_for_session(session, now=now)
    assert res == 60


@pytest.mark.asyncio
async def test_message_reads_all_branches() -> None:
    session_id = uuid.uuid4()
    viewer_id = uuid.uuid4()
    mock_db = AsyncMock()

    msg_sys = SfChatMessage(id=uuid.uuid4(), session_id=session_id, sender_user_id=None, body="Sys msg", is_system=True, is_bot=False, created_at=datetime.now(UTC))
    msg_bot = SfChatMessage(id=uuid.uuid4(), session_id=session_id, sender_user_id=None, body="Bot msg", is_system=False, is_bot=True, created_at=datetime.now(UTC))
    
    user_with_name = User(id=uuid.uuid4(), display_name="John", email="john@example.com")
    msg_user_name = SfChatMessage(id=uuid.uuid4(), session_id=session_id, sender_user_id=user_with_name.id, body="User name msg", is_system=False, is_bot=False, created_at=datetime.now(UTC))
    
    user_with_email = User(id=uuid.uuid4(), display_name=None, email="email@example.com")
    msg_user_email = SfChatMessage(id=uuid.uuid4(), session_id=session_id, sender_user_id=user_with_email.id, body="User email msg", is_system=False, is_bot=False, created_at=datetime.now(UTC))

    msg_unknown = SfChatMessage(id=uuid.uuid4(), session_id=session_id, sender_user_id=uuid.uuid4(), body="Unknown msg", is_system=False, is_bot=False, created_at=datetime.now(UTC))

    mock_result = MagicMock()
    mock_result.all.return_value = [
        (msg_sys, None),
        (msg_bot, None),
        (msg_user_name, user_with_name),
        (msg_user_email, user_with_email),
        (msg_unknown, None),
    ]
    mock_db.execute = AsyncMock(return_value=mock_result)

    reads = await sf_chat._message_reads(mock_db, session_id, viewer_id)
    assert len(reads) == 5
    assert reads[0].sender_display_name == "System"
    assert reads[1].sender_display_name == "Sag-assistent"
    assert reads[2].sender_display_name == "John"
    assert reads[3].sender_display_name == "email@example.com"
    assert reads[4].sender_display_name == "Ukendt"


@pytest.mark.asyncio
async def test_pick_agent_and_load_balancing() -> None:
    mock_db = AsyncMock()

    # 1. Test no online agents
    # Mock _fresh_online_agent_ids -> get_sf_team_id -> None
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_team_result)
    assert await sf_chat._pick_agent(mock_db) is None

    # 2. Test multiple agents with load balancing
    agent1 = uuid.uuid4()
    agent2 = uuid.uuid4()
    
    # Mock _fresh_online_agent_ids -> get_sf_team_id -> team_id
    team_id = uuid.uuid4()
    mock_team_result.scalar_one_or_none.return_value = team_id

    # Mock _fresh_online_agent_ids -> agents list
    mock_agents_result = MagicMock()
    mock_agents_result.scalars.return_value.all.return_value = [agent1, agent2]

    # Mock active session counts: agent1 has load 2, agent2 has load 1
    mock_count_agent1 = MagicMock()
    mock_count_agent1.scalar_one.return_value = 2
    mock_count_agent2 = MagicMock()
    mock_count_agent2.scalar_one.return_value = 1

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_agents_result,
        mock_count_agent1,
        mock_count_agent2,
    ])

    picked = await sf_chat._pick_agent(mock_db)
    assert picked == agent2

    # 3. Test load >= 3 limit (no agent picked)
    mock_count_agent1.scalar_one.return_value = 4
    mock_count_agent2.scalar_one.return_value = 3
    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_agents_result,
        mock_count_agent1,
        mock_count_agent2,
    ])
    assert await sf_chat._pick_agent(mock_db) is None


@pytest.mark.asyncio
async def test_try_assign_agent_presence_creation() -> None:
    session = SfChatSession(id=uuid.uuid4(), status=SESSION_WAITING)
    agent_id = uuid.uuid4()
    mock_db = AsyncMock()

    # Mock _pick_agent -> get_sf_team_id -> team_id
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = uuid.uuid4()
    # Mock _pick_agent -> agents list
    mock_agents_result = MagicMock()
    mock_agents_result.scalars.return_value.all.return_value = [agent_id]
    # Mock _pick_agent -> active count
    mock_count_result = MagicMock()
    mock_count_result.scalar_one.return_value = 0

    # Mock db.get(SfChatPresence, agent_id) -> None (presence does not exist)
    mock_db.get = AsyncMock(return_value=None)

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_agents_result,
        mock_count_result,
    ])

    await sf_chat._try_assign_agent(mock_db, session)
    assert session.assigned_agent_id == agent_id
    assert session.status == SESSION_ACTIVE
    mock_db.add.assert_called_once()  # Adds new SfChatPresence


@pytest.mark.asyncio
async def test_set_presence_offline_closes_active_sessions() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    # Mock logout_check -> can_logout=True
    # logout_check has 4 queries inside: is_sf_team_member, SfChatPresence get, active_count, waiting_count, typing_waiting
    # But since online=False and force=True, we don't call logout_check!
    # Let's call set_presence_online with force=True
    session = SfChatSession(id=uuid.uuid4(), status=SESSION_ACTIVE, assigned_agent_id=user.id)
    mock_active_sessions = MagicMock()
    mock_active_sessions.scalars.return_value.all.return_value = [session]

    # Mock SfChatPresence get
    presence = SfChatPresence(user_id=user.id, is_online=True, active_session_id=session.id)
    mock_db.get = AsyncMock(return_value=presence)

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_member_result,
        mock_active_sessions,
    ])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    res = await sf_chat.set_presence_online(mock_db, user, online=False, force=True)
    assert res.is_online is False
    assert session.status == SESSION_CLOSED
    assert presence.active_session_id is None


@pytest.mark.asyncio
async def test_heartbeat_presence_not_sf_member_or_offline() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # 1. Not SF member
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_team_result)
    await sf_chat.heartbeat_presence(mock_db, user)
    mock_db.commit.assert_not_awaited()

    # 2. Offline presence
    mock_team_result.scalar_one_or_none.return_value = uuid.uuid4()
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = uuid.uuid4()
    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])
    
    presence = SfChatPresence(user_id=user.id, is_online=False)
    mock_db.get = AsyncMock(return_value=presence)
    await sf_chat.heartbeat_presence(mock_db, user)
    mock_db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_logout_check_reasons() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    presence = SfChatPresence(user_id=user.id, is_online=True)
    mock_db.get = AsyncMock(return_value=presence)

    # Mock active_count = 1, waiting_count = 2, typing_waiting = 1
    mock_active = MagicMock()
    mock_active.scalar_one.return_value = 1
    mock_waiting = MagicMock()
    mock_waiting.scalar_one.return_value = 2
    mock_typing = MagicMock()
    mock_typing.scalar_one.return_value = 1

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_member_result,
        mock_active,
        mock_waiting,
        mock_typing,
    ])

    check = await sf_chat.logout_check(mock_db, user)
    assert check.can_logout is False
    assert "1 aktiv chat" in check.reason
    assert "2 venter i kø" in check.reason
    assert "kunder skriver lige nu" in check.reason


@pytest.mark.asyncio
async def test_start_bot_assistant_errors() -> None:
    agent = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id
    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])

    # 1. Session not found
    mock_db.get = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="session_not_found"):
        await sf_chat.start_bot_assistant_for_session(mock_db, session_id=uuid.uuid4(), agent=agent)

    # 2. Wrong status (not waiting)
    session = SfChatSession(id=uuid.uuid4(), status=SESSION_ACTIVE)
    mock_db.get = AsyncMock(return_value=session)
    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])
    with pytest.raises(ValueError, match="not_waiting"):
        await sf_chat.start_bot_assistant_for_session(mock_db, session_id=session.id, agent=agent)

    # 3. Already active
    session = SfChatSession(id=uuid.uuid4(), status=SESSION_WAITING, bot_assistant_active=True, created_at=datetime.now(UTC), updated_at=datetime.now(UTC))
    mock_db.get = AsyncMock(return_value=session)
    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])
    res = await sf_chat.start_bot_assistant_for_session(mock_db, session_id=session.id, agent=agent)
    assert res.bot_assistant_active is True


@pytest.mark.asyncio
async def test_session_for_user_detailed() -> None:
    customer = User(id=uuid.uuid4())
    agent = User(id=uuid.uuid4())
    session = SfChatSession(id=uuid.uuid4(), customer_user_id=customer.id, assigned_agent_id=agent.id, status=SESSION_CLOSED)
    mock_db = AsyncMock()

    # 1. Session not found
    mock_db.get = AsyncMock(return_value=None)
    assert await sf_chat.session_for_user(mock_db, session.id, customer) is None

    # 2. Customer matches
    mock_db.get = AsyncMock(return_value=session)
    assert await sf_chat.session_for_user(mock_db, session.id, customer) == session

    # 3. SF member assigned and closed
    mock_db.get = AsyncMock(return_value=session)
    # Mock is_sf_team_member -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id
    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])
    assert await sf_chat.session_for_user(mock_db, session.id, agent) == session

    # 4. Forbidden user
    other = User(id=uuid.uuid4())
    mock_db.get = AsyncMock(return_value=session)
    # Mock is_sf_team_member -> False
    mock_team_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_team_result)
    assert await sf_chat.session_for_user(mock_db, session.id, other) is None


@pytest.mark.asyncio
async def test_create_ticket_error_not_sf_member() -> None:
    agent = User(id=uuid.uuid4())
    mock_db = AsyncMock()
    # Mock is_sf_team_member -> False
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_team_result)
    with pytest.raises(ValueError, match="not_sf_member"):
        await sf_chat.create_ticket_from_sf_chat_session(mock_db, session_id=uuid.uuid4(), agent=agent, title="Title")


@pytest.mark.asyncio
async def test_create_ticket_error_session_not_found() -> None:
    agent = User(id=uuid.uuid4())
    mock_db = AsyncMock()
    # Mock is_sf_team_member -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id
    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])
    mock_db.get = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="session_not_found"):
        await sf_chat.create_ticket_from_sf_chat_session(mock_db, session_id=uuid.uuid4(), agent=agent, title="Title")


@pytest.mark.asyncio
async def test_create_ticket_error_not_closed() -> None:
    agent = User(id=uuid.uuid4())
    mock_db = AsyncMock()
    # Mock is_sf_team_member -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id
    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])
    session = SfChatSession(id=uuid.uuid4(), status=SESSION_ACTIVE)
    mock_db.get = AsyncMock(return_value=session)
    with pytest.raises(ValueError, match="session_not_closed"):
        await sf_chat.create_ticket_from_sf_chat_session(mock_db, session_id=session.id, agent=agent, title="Title")


@pytest.mark.asyncio
async def test_create_ticket_error_wrong_agent() -> None:
    agent = User(id=uuid.uuid4())
    mock_db = AsyncMock()
    # Mock is_sf_team_member -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id
    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])
    session = SfChatSession(id=uuid.uuid4(), status=SESSION_CLOSED, assigned_agent_id=uuid.uuid4())
    mock_db.get = AsyncMock(return_value=session)
    with pytest.raises(ValueError, match="not_assigned_agent"):
        await sf_chat.create_ticket_from_sf_chat_session(mock_db, session_id=session.id, agent=agent, title="Title")


@pytest.mark.asyncio
async def test_create_ticket_error_short_title() -> None:
    agent = User(id=uuid.uuid4())
    mock_db = AsyncMock()
    # Mock is_sf_team_member -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id
    
    # Mock _message_reads query inside create_ticket
    mock_messages_result = MagicMock()
    mock_messages_result.all.return_value = []
    
    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result, mock_messages_result])
    session = SfChatSession(id=uuid.uuid4(), status=SESSION_CLOSED, assigned_agent_id=agent.id, customer_user_id=uuid.uuid4())
    mock_db.get = AsyncMock(side_effect=[session, None])
    with pytest.raises(ValueError, match="title_too_short"):
        await sf_chat.create_ticket_from_sf_chat_session(mock_db, session_id=session.id, agent=agent, title="  ")


@pytest.mark.asyncio
async def test_maybe_reconcile_stale_agent_sessions_stale_agent_no_presence() -> None:
    agent_id = uuid.uuid4()
    session = SfChatSession(id=uuid.uuid4(), status=SESSION_ACTIVE, assigned_agent_id=agent_id)
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [session]
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Mock SfChatPresence to be None
    mock_db.get = AsyncMock(return_value=None)

    await sf_chat.maybe_reconcile_stale_agent_sessions(mock_db)
    assert session.status == SESSION_CLOSED
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_pick_agent_load_balancing_third_agent() -> None:
    mock_db = AsyncMock()
    agent1 = uuid.uuid4()
    agent2 = uuid.uuid4()
    agent3 = uuid.uuid4()
    
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id

    mock_agents_result = MagicMock()
    mock_agents_result.scalars.return_value.all.return_value = [agent1, agent2, agent3]

    # agent1 has load 1, agent2 has load 2 (higher than agent1, so load < best_load is False), agent3 has load 0
    mock_count_agent1 = MagicMock()
    mock_count_agent1.scalar_one.return_value = 1
    mock_count_agent2 = MagicMock()
    mock_count_agent2.scalar_one.return_value = 2
    mock_count_agent3 = MagicMock()
    mock_count_agent3.scalar_one.return_value = 0

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_agents_result,
        mock_count_agent1,
        mock_count_agent2,
        mock_count_agent3,
    ])

    picked = await sf_chat._pick_agent(mock_db)
    assert picked == agent3


@pytest.mark.asyncio
async def test_try_assign_agent_presence_exists() -> None:
    session = SfChatSession(id=uuid.uuid4(), status=SESSION_WAITING)
    agent_id = uuid.uuid4()
    mock_db = AsyncMock()

    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = uuid.uuid4()
    mock_agents_result = MagicMock()
    mock_agents_result.scalars.return_value.all.return_value = [agent_id]
    mock_count_result = MagicMock()
    mock_count_result.scalar_one.return_value = 0

    presence = SfChatPresence(user_id=agent_id, is_online=True)
    mock_db.get = AsyncMock(return_value=presence)

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_agents_result,
        mock_count_result,
    ])

    await sf_chat._try_assign_agent(mock_db, session)
    assert session.assigned_agent_id == agent_id
    assert session.status == SESSION_ACTIVE
    assert presence.active_session_id == session.id


@pytest.mark.asyncio
async def test_add_message_customer_waiting_with_agents() -> None:
    session_id = uuid.uuid4()
    sender = User(id=uuid.uuid4())
    session = SfChatSession(id=session_id, customer_user_id=sender.id, status=SESSION_WAITING, bot_assistant_active=False)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    # Mock is_sf_team_member check -> False
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None

    # Mock _try_assign_agent -> get_sf_team_id -> None
    mock_pick_team_result = MagicMock()
    mock_pick_team_result.scalar_one_or_none.return_value = None

    # Mock _fresh_online_agent_ids inside add_message -> returns online agents
    mock_fresh_team_result = MagicMock()
    mock_fresh_team_result.scalar_one_or_none.return_value = uuid.uuid4()
    mock_fresh_agents_result = MagicMock()
    mock_fresh_agents_result.scalars.return_value.all.return_value = [uuid.uuid4()]

    # Mock _message_reads query
    mock_messages_result = MagicMock()
    mock_messages_result.all.return_value = []

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_pick_team_result,
        mock_fresh_team_result,
        mock_fresh_agents_result,
        mock_messages_result,
    ])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    msg = await sf_chat.add_message(mock_db, session_id, sender, "Hello")
    assert msg.body == "Hello"
    assert session.status == SESSION_WAITING


@pytest.mark.asyncio
async def test_add_message_sf_agent_waiting_assigns_with_presence() -> None:
    session_id = uuid.uuid4()
    sender = User(id=uuid.uuid4())
    session = SfChatSession(id=session_id, customer_user_id=uuid.uuid4(), status=SESSION_WAITING)
    mock_db = AsyncMock()
    
    presence = SfChatPresence(user_id=sender.id, is_online=True)
    mock_db.get = AsyncMock(side_effect=[session, presence])

    # Mock is_sf_team_member check -> True (returns team_id)
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    await sf_chat.add_message(mock_db, session_id, sender, "Hello")
    assert session.assigned_agent_id == sender.id
    assert session.status == SESSION_ACTIVE
    assert presence.active_session_id == session.id


@pytest.mark.asyncio
@patch("star_itsm_api.services.sf_chat.build_bot_reply_for_customer")
async def test_add_message_bot_assistant_reply_no_customer(mock_build_bot_reply) -> None:
    session_id = uuid.uuid4()
    sender = User(id=uuid.uuid4())
    session = SfChatSession(id=session_id, customer_user_id=sender.id, status=SESSION_WAITING, bot_assistant_active=True)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=[session, None]) # Once for session, once for customer in bot reply -> returns None

    # Mock is_sf_team_member check -> False
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_team_result)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    msg = await sf_chat.add_message(mock_db, session_id, sender, "Hello")
    assert msg.body == "Hello"
    mock_build_bot_reply.assert_not_called()


@pytest.mark.asyncio
async def test_set_presence_online_success_can_logout() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    row = SfChatPresence(user_id=user.id, is_online=True)
    mock_db.get = AsyncMock(return_value=row)

    # Mock logout_check inside set_presence_online:
    # active_count = 0, waiting_count = 0, typing_waiting = 0
    mock_active = MagicMock()
    mock_active.scalar_one.return_value = 0
    mock_waiting = MagicMock()
    mock_waiting.scalar_one.return_value = 0
    mock_typing = MagicMock()
    mock_typing.scalar_one.return_value = 0

    mock_active_sessions = MagicMock()
    mock_active_sessions.scalars.return_value.all.return_value = []

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_member_result,
        # Inside logout_check:
        mock_team_result,
        mock_member_result,
        mock_active,
        mock_waiting,
        mock_typing,
        # Inside set_presence_online:
        mock_active_sessions,
    ])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    presence = await sf_chat.set_presence_online(mock_db, user, online=False, force=False)
    assert presence.is_online is False
    assert row.is_online is False
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_set_presence_online_success_no_presence() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    mock_db.get = AsyncMock(return_value=None)

    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    presence = await sf_chat.set_presence_online(mock_db, user, online=True, force=False)
    assert presence.is_online is True
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_logout_check_active_zero_but_waiting() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    presence = SfChatPresence(user_id=user.id, is_online=True)
    mock_db.get = AsyncMock(return_value=presence)

    # Mock active_count = 0, waiting_count = 2, typing_waiting = 0
    mock_active = MagicMock()
    mock_active.scalar_one.return_value = 0
    mock_waiting = MagicMock()
    mock_waiting.scalar_one.return_value = 2
    mock_typing = MagicMock()
    mock_typing.scalar_one.return_value = 0

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_member_result,
        mock_active,
        mock_waiting,
        mock_typing,
    ])

    check = await sf_chat.logout_check(mock_db, user)
    assert check.can_logout is False
    assert "2 venter i kø" in check.reason
    assert "aktiv chat" not in check.reason


@pytest.mark.asyncio
async def test_logout_check_success() -> None:
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()

    # Mock is_sf_team_member -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    presence = SfChatPresence(user_id=user.id, is_online=True)
    mock_db.get = AsyncMock(return_value=presence)

    # Mock active_count = 0, waiting_count = 0, typing_waiting = 0
    mock_active = MagicMock()
    mock_active.scalar_one.return_value = 0
    mock_waiting = MagicMock()
    mock_waiting.scalar_one.return_value = 0
    mock_typing = MagicMock()
    mock_typing.scalar_one.return_value = 0

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_member_result,
        mock_active,
        mock_waiting,
        mock_typing,
    ])

    check = await sf_chat.logout_check(mock_db, user)
    assert check.can_logout is True


@pytest.mark.asyncio
async def test_build_agent_inbox_unread_and_no_agent_and_typing_and_system_preview() -> None:
    agent = User(id=uuid.uuid4(), display_name="Agent Anna", email="anna@example.com")
    customer = User(id=uuid.uuid4(), display_name="Cust", email="cust@example.com")
    session = SfChatSession(
        id=uuid.uuid4(),
        customer_user_id=customer.id,
        status=SESSION_ACTIVE,
        assigned_agent_id=None, # No assigned agent
        customer_last_typing_at=datetime.now(UTC), # Typing is active
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    mock_db = AsyncMock()

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    # Mock maybe_reconcile_stale_agent_sessions -> execute SfChatSession list
    mock_sessions_result = MagicMock()
    mock_sessions_result.scalars.return_value.all.return_value = []

    # Mock SfChatPresence get
    presence = SfChatPresence(user_id=agent.id, is_online=True)
    mock_db.get = AsyncMock(return_value=presence)

    # Mock build_agent_inbox rows query
    mock_rows_result = MagicMock()
    mock_rows_result.all.return_value = [(session, customer)]

    # Mock count_waiting_sessions
    mock_waiting_result = MagicMock()
    mock_waiting_result.scalar_one.return_value = 0

    # Mock _fresh_online_agent_ids -> get_sf_team_id
    mock_fresh_team_result = MagicMock()
    mock_fresh_team_result.scalar_one_or_none.return_value = team_id

    # Mock _fresh_online_agent_ids -> agents list
    mock_fresh_agents_result = MagicMock()
    mock_fresh_agents_result.scalars.return_value.all.return_value = [agent.id]

    # Mock last message query -> system message to trigger system preview
    last_msg = SfChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        sender_user_id=customer.id, # from customer to trigger unread
        body="System closed",
        is_system=True, # system message
        created_at=datetime.now(UTC),
    )
    mock_last_msg_result = MagicMock()
    mock_last_msg_result.scalar_one_or_none.return_value = last_msg

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_member_result,
        mock_sessions_result,
        mock_rows_result,
        mock_waiting_result,
        mock_fresh_team_result,
        mock_fresh_agents_result,
        mock_last_msg_result,
    ])

    inbox = await sf_chat.build_agent_inbox(mock_db, agent)
    assert inbox.online is True
    assert len(inbox.items) == 1
    assert inbox.items[0].customer_display_name == "Cust"
    assert inbox.items[0].last_message_preview == "System: System closed"
    assert inbox.items[0].customer_is_typing is True


@pytest.mark.asyncio
async def test_start_bot_assistant_for_session_assigned_agent() -> None:
    agent = User(id=uuid.uuid4())
    session = SfChatSession(id=uuid.uuid4(), status=SESSION_WAITING, bot_assistant_active=False, assigned_agent_id=uuid.uuid4(), created_at=datetime.now(UTC), updated_at=datetime.now(UTC))
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=[session, None])

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id
    
    # Mock _user_display
    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    res = await sf_chat.start_bot_assistant_for_session(mock_db, session_id=session.id, agent=agent)
    assert res.bot_assistant_active is True
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_session_for_user_forbidden_active() -> None:
    customer = User(id=uuid.uuid4())
    agent = User(id=uuid.uuid4())
    session = SfChatSession(id=uuid.uuid4(), customer_user_id=customer.id, assigned_agent_id=uuid.uuid4(), status=SESSION_ACTIVE)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=session)

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id
    mock_db.execute = AsyncMock(side_effect=[mock_team_result, mock_member_result])

    result = await sf_chat.session_for_user(mock_db, session.id, agent)
    assert result is None


@pytest.mark.asyncio
@patch("star_itsm_api.services.sf_chat.apply_routing")
@patch("star_itsm_api.services.sf_chat.apply_sla_to_ticket")
@patch("star_itsm_api.services.sf_chat.generate_ticket_number")
@patch("star_itsm_api.services.sf_chat.resolve_create_security_flag")
async def test_create_ticket_from_sf_chat_session_success_long_description_and_assigned(
    mock_resolve_security,
    mock_gen_number,
    mock_apply_sla,
    mock_apply_routing,
) -> None:
    agent = User(id=uuid.uuid4(), organization_id=uuid.uuid4())
    customer = User(id=uuid.uuid4(), display_name="John Cust", email="john@example.com")
    session = SfChatSession(id=uuid.uuid4(), customer_user_id=customer.id, status=SESSION_CLOSED, assigned_agent_id=agent.id)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=[session, customer])

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    # Mock _message_reads query to return a message (long description)
    msg = SfChatMessage(id=uuid.uuid4(), session_id=session.id, sender_user_id=customer.id, body="Hello this is a very long message indeed", is_system=False, is_bot=False, created_at=datetime.now(UTC))
    mock_messages_result = MagicMock()
    mock_messages_result.all.return_value = [(msg, customer)]

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_member_result,
        mock_messages_result,
    ])
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    # Mock patches
    mock_resolve_security.return_value = False
    mock_gen_number.return_value = "INC-12345"
    
    async def side_effect_apply_sla(db, ticket, priority, start_at):
        ticket.status = "assigned"
    mock_apply_sla.side_effect = side_effect_apply_sla

    routing_mock = MagicMock()
    routing_mock.priority = "medium"
    routing_mock.assigned_team_id = uuid.uuid4()
    routing_mock.assigned_user_id = agent.id # assigned to agent -> status is "assigned"
    mock_apply_routing.return_value = routing_mock

    ticket = await sf_chat.create_ticket_from_sf_chat_session(
        mock_db,
        session_id=session.id,
        agent=agent,
        title="Custom Title",
    )

    assert ticket.title == "Custom Title"
    assert ticket.ticket_number == "INC-12345"
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_build_agent_inbox_no_last_message() -> None:
    agent = User(id=uuid.uuid4(), display_name="Agent Anna", email="anna@example.com")
    customer = User(id=uuid.uuid4(), display_name="Cust", email="cust@example.com")
    session = SfChatSession(
        id=uuid.uuid4(),
        customer_user_id=customer.id,
        status=SESSION_ACTIVE,
        assigned_agent_id=agent.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    mock_db = AsyncMock()

    # Mock is_sf_team_member check -> True
    team_id = uuid.uuid4()
    mock_team_result = MagicMock()
    mock_team_result.scalar_one_or_none.return_value = team_id
    mock_member_result = MagicMock()
    mock_member_result.scalar_one_or_none.return_value = team_id

    # Mock maybe_reconcile_stale_agent_sessions -> execute SfChatSession list
    mock_sessions_result = MagicMock()
    mock_sessions_result.scalars.return_value.all.return_value = []

    # Mock SfChatPresence get
    presence = SfChatPresence(user_id=agent.id, is_online=True)
    mock_db.get = AsyncMock(side_effect=[presence, None])

    # Mock build_agent_inbox rows query
    mock_rows_result = MagicMock()
    mock_rows_result.all.return_value = [(session, customer)]

    # Mock count_waiting_sessions
    mock_waiting_result = MagicMock()
    mock_waiting_result.scalar_one.return_value = 0

    # Mock _fresh_online_agent_ids -> get_sf_team_id
    mock_fresh_team_result = MagicMock()
    mock_fresh_team_result.scalar_one_or_none.return_value = team_id

    # Mock _fresh_online_agent_ids -> agents list
    mock_fresh_agents_result = MagicMock()
    mock_fresh_agents_result.scalars.return_value.all.return_value = [agent.id]

    # Mock last message query -> returns None
    mock_last_msg_result = MagicMock()
    mock_last_msg_result.scalar_one_or_none.return_value = None

    mock_db.execute = AsyncMock(side_effect=[
        mock_team_result,
        mock_member_result,
        mock_sessions_result,
        mock_rows_result,
        mock_waiting_result,
        mock_fresh_team_result,
        mock_fresh_agents_result,
        mock_last_msg_result,
    ])

    inbox = await sf_chat.build_agent_inbox(mock_db, agent)
    assert inbox.online is True
    assert len(inbox.items) == 1
    assert inbox.items[0].last_message_preview is None


