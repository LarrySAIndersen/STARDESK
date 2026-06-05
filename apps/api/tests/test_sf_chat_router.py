import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from star_itsm_api.models.sf_chat_session import (
    SESSION_ACTIVE,
    SESSION_CLOSED,
    SESSION_REJECTED_QUEUE,
)
from star_itsm_api.schemas.sf_chat import (
    SfChatAgentInboxRead,
    SfChatLogoutCheckRead,
    SfChatPresenceRead,
    SfChatSessionRead,
    SfChatStatusRead,
)
from star_itsm_api.schemas.ticket import TicketRead


@pytest.fixture
def sample_status_read() -> SfChatStatusRead:
    return SfChatStatusRead(
        open=True,
        available_agents=2,
        message="Chatten er åben",
        waiting_sessions=0,
        estimated_wait_minutes=None,
    )


@pytest.fixture
def sample_session_read() -> SfChatSessionRead:
    return SfChatSessionRead(
        id=uuid.uuid4(),
        status=SESSION_ACTIVE,
        assigned_agent_id=uuid.uuid4(),
        assigned_agent_name="Agent 1",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        queue_message=None,
        bot_assistant_active=False,
        wait_seconds=None,
    )


@pytest.fixture
def sample_presence_read() -> SfChatPresenceRead:
    return SfChatPresenceRead(
        is_online=True,
        is_sf_member=True,
        active_session_id=None,
        last_seen_at=datetime.now(UTC),
    )


@pytest.fixture
def sample_ticket_read() -> TicketRead:
    return TicketRead(
        id=uuid.uuid4(),
        ticket_number="DEMO-123",
        title="Test Ticket",
        status="new",
        priority="medium",
        ticket_type="incident",
        created_at=datetime.now(UTC),
    )


@pytest.fixture(autouse=True)
def _use_mock_db(override_db: AsyncMock) -> None:
    pass


@pytest.mark.asyncio
async def test_chat_status_endpoint(
    client: AsyncClient,
    sample_status_read: SfChatStatusRead,
) -> None:
    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.get_chat_status",
        AsyncMock(return_value=sample_status_read),
    ) as mock_get_status:
        response = await client.get("/api/v1/sf-chat/status")
        assert response.status_code == 200
        data = response.json()
        assert data["open"] is True
        assert data["available_agents"] == 2
        mock_get_status.assert_called_once()


@pytest.mark.asyncio
async def test_start_session_success(
    client: AsyncClient,
    sample_session_read: SfChatSessionRead,
) -> None:
    session_mock = MagicMock()
    session_mock.assigned_agent_id = sample_session_read.assigned_agent_id
    session_mock.status = SESSION_ACTIVE

    status_mock = MagicMock()
    status_mock.open = True

    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.get_or_create_customer_session",
        AsyncMock(return_value=(session_mock, [], status_mock, None)),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc._user_display",
        AsyncMock(return_value="Agent 1"),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc._session_read",
        return_value=sample_session_read,
    ):
        response = await client.post("/api/v1/sf-chat/sessions")
        assert response.status_code == 200
        data = response.json()
        assert data["session"]["id"] == str(sample_session_read.id)


@pytest.mark.asyncio
async def test_start_session_closed(
    client: AsyncClient,
    sample_session_read: SfChatSessionRead,
) -> None:
    session_mock = MagicMock()
    session_mock.assigned_agent_id = None
    session_mock.status = SESSION_CLOSED

    status_mock = MagicMock()
    status_mock.open = False

    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.get_or_create_customer_session",
        AsyncMock(return_value=(session_mock, [], status_mock, None)),
    ):
        response = await client.post("/api/v1/sf-chat/sessions")
        assert response.status_code == 503


@pytest.mark.asyncio
async def test_start_session_rejected_queue(
    client: AsyncClient,
    sample_session_read: SfChatSessionRead,
) -> None:
    session_mock = MagicMock()
    session_mock.assigned_agent_id = None
    session_mock.status = SESSION_REJECTED_QUEUE

    status_mock = MagicMock()
    status_mock.open = True

    sample_session_read.status = SESSION_REJECTED_QUEUE
    sample_session_read.queue_message = "Køen er fuld"

    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.get_or_create_customer_session",
        AsyncMock(return_value=(session_mock, [], status_mock, "Køen er fuld")),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc._session_read",
        return_value=sample_session_read,
    ):
        response = await client.post("/api/v1/sf-chat/sessions")
        assert response.status_code == 200
        data = response.json()
        assert data["session"]["status"] == SESSION_REJECTED_QUEUE


@pytest.mark.asyncio
async def test_poll_session_success(
    client: AsyncClient,
    sample_session_read: SfChatSessionRead,
    sample_status_read: SfChatStatusRead,
) -> None:
    session_id = uuid.uuid4()
    session_mock = MagicMock()
    session_mock.id = session_id
    session_mock.assigned_agent_id = sample_session_read.assigned_agent_id
    session_mock.status = SESSION_ACTIVE

    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.get_chat_status",
        AsyncMock(return_value=sample_status_read),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc.session_for_user",
        AsyncMock(return_value=session_mock),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc._user_display",
        AsyncMock(return_value="Agent 1"),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc._message_reads",
        AsyncMock(return_value=[]),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc._session_read",
        return_value=sample_session_read,
    ):
        response = await client.get(f"/api/v1/sf-chat/sessions/{session_id}/poll")
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_poll_session_not_found(
    client: AsyncClient,
    sample_status_read: SfChatStatusRead,
) -> None:
    session_id = uuid.uuid4()
    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.get_chat_status",
        AsyncMock(return_value=sample_status_read),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc.session_for_user",
        AsyncMock(return_value=None),
    ):
        response = await client.get(f"/api/v1/sf-chat/sessions/{session_id}/poll")
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_poll_session_no_assigned_agent(
    client: AsyncClient,
    sample_session_read: SfChatSessionRead,
    sample_status_read: SfChatStatusRead,
) -> None:
    session_id = uuid.uuid4()
    session = MagicMock()
    session.id = session_id
    session.assigned_agent_id = None
    session.status = SESSION_ACTIVE

    sample_session_read.assigned_agent_id = None
    sample_session_read.assigned_agent_name = None

    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.get_chat_status",
        AsyncMock(return_value=sample_status_read),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc.session_for_user",
        AsyncMock(return_value=session),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc._message_reads",
        AsyncMock(return_value=[]),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc._session_read",
        return_value=sample_session_read,
    ):
        response = await client.get(f"/api/v1/sf-chat/sessions/{session_id}/poll")
        assert response.status_code == 200
        data = response.json()
        assert data["session"]["assigned_agent_id"] is None


@pytest.mark.asyncio
async def test_post_message_success(
    client: AsyncClient,
) -> None:
    session_id = uuid.uuid4()
    session_mock = MagicMock()

    msg_mock = MagicMock()
    msg_mock.id = uuid.uuid4()
    msg_mock.session_id = session_id
    msg_mock.sender_user_id = uuid.uuid4()
    msg_mock.body = "Hej"
    msg_mock.created_at = datetime.now(UTC)
    msg_mock.is_system = False

    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.session_for_user",
        AsyncMock(return_value=session_mock),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc.add_message",
        AsyncMock(return_value=msg_mock),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc._user_display",
        AsyncMock(return_value="Kunde"),
    ):
        response = await client.post(
            f"/api/v1/sf-chat/sessions/{session_id}/messages",
            json={"body": "Hej"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["body"] == "Hej"


@pytest.mark.asyncio
async def test_post_message_session_not_found(
    client: AsyncClient,
) -> None:
    session_id = uuid.uuid4()
    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.session_for_user",
        AsyncMock(return_value=None),
    ):
        response = await client.post(
            f"/api/v1/sf-chat/sessions/{session_id}/messages",
            json={"body": "Hej"},
        )
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_post_message_failures(
    client: AsyncClient,
) -> None:
    session_id = uuid.uuid4()
    session_mock = MagicMock()

    for exc_msg, expected_code in [
        ("queue_rejected", 503),
        ("chat_closed", 503),
        ("forbidden", 403),
        ("other_error", 400),
    ]:
        with patch(
            "star_itsm_api.routers.sf_chat.chat_svc.session_for_user",
            AsyncMock(return_value=session_mock),
        ), patch(
            "star_itsm_api.routers.sf_chat.chat_svc.add_message",
            AsyncMock(side_effect=ValueError(exc_msg)),
        ):
            response = await client.post(
                f"/api/v1/sf-chat/sessions/{session_id}/messages",
                json={"body": "Hej"},
            )
            assert response.status_code == expected_code


@pytest.mark.asyncio
async def test_customer_typing(
    client: AsyncClient,
) -> None:
    session_id = uuid.uuid4()
    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.record_customer_typing",
        AsyncMock(),
    ) as mock_typing:
        response = await client.post(f"/api/v1/sf-chat/sessions/{session_id}/typing")
        assert response.status_code == 204
        mock_typing.assert_called_once()


@pytest.mark.asyncio
async def test_abandon_session_success(
    client: AsyncClient,
    sample_session_read: SfChatSessionRead,
) -> None:
    session_id = uuid.uuid4()
    session_mock = MagicMock()

    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.abandon_customer_session",
        AsyncMock(return_value=session_mock),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc._session_read",
        return_value=sample_session_read,
    ):
        response = await client.post(f"/api/v1/sf-chat/sessions/{session_id}/abandon")
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_abandon_session_not_found(
    client: AsyncClient,
) -> None:
    session_id = uuid.uuid4()
    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.abandon_customer_session",
        AsyncMock(return_value=None),
    ):
        response = await client.post(f"/api/v1/sf-chat/sessions/{session_id}/abandon")
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_ticket_from_sf_chat_success(
    client: AsyncClient,
    sample_ticket_read: TicketRead,
) -> None:
    session_id = uuid.uuid4()
    session_mock = MagicMock()
    ticket_mock = MagicMock()

    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.session_for_user",
        AsyncMock(return_value=session_mock),
    ), patch(
        "star_itsm_api.routers.sf_chat.chat_svc.create_ticket_from_sf_chat_session",
        AsyncMock(return_value=ticket_mock),
    ), patch(
        "star_itsm_api.routers.sf_chat.ticket_to_read",
        AsyncMock(return_value=sample_ticket_read),
    ):
        response = await client.post(
            f"/api/v1/sf-chat/sessions/{session_id}/create-ticket",
            json={"title": "Test Title"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == str(sample_ticket_read.id)


@pytest.mark.asyncio
async def test_create_ticket_from_sf_chat_not_found(
    client: AsyncClient,
) -> None:
    session_id = uuid.uuid4()
    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.session_for_user",
        AsyncMock(return_value=None),
    ):
        response = await client.post(
            f"/api/v1/sf-chat/sessions/{session_id}/create-ticket",
            json={"title": "Test Title"},
        )
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_ticket_from_sf_chat_failures(
    client: AsyncClient,
) -> None:
    session_id = uuid.uuid4()
    session_mock = MagicMock()

    for exc_msg, expected_code in [
        ("not_sf_member", 403),
        ("session_not_closed", 409),
        ("not_assigned_agent", 403),
        ("title_too_short", 400),
        ("other_error", 400),
    ]:
        with patch(
            "star_itsm_api.routers.sf_chat.chat_svc.session_for_user",
            AsyncMock(return_value=session_mock),
        ), patch(
            "star_itsm_api.routers.sf_chat.chat_svc.create_ticket_from_sf_chat_session",
            AsyncMock(side_effect=ValueError(exc_msg)),
        ):
            response = await client.post(
                f"/api/v1/sf-chat/sessions/{session_id}/create-ticket",
                json={"title": "Test Title"},
            )
            assert response.status_code == expected_code


@pytest.mark.asyncio
async def test_get_presence(
    client: AsyncClient,
    sample_presence_read: SfChatPresenceRead,
) -> None:
    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.get_presence",
        AsyncMock(return_value=sample_presence_read),
    ):
        response = await client.get("/api/v1/sf-chat/presence")
        assert response.status_code == 200
        data = response.json()
        assert data["is_online"] is True


@pytest.mark.asyncio
async def test_update_presence_success(
    client: AsyncClient,
    sample_presence_read: SfChatPresenceRead,
) -> None:
    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.set_presence_online",
        AsyncMock(return_value=sample_presence_read),
    ):
        response = await client.put(
            "/api/v1/sf-chat/presence",
            json={"online": True, "force": False},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_online"] is True


@pytest.mark.asyncio
async def test_update_presence_failures(
    client: AsyncClient,
) -> None:
    for exc_msg, expected_code in [
        ("not_sf_member", 403),
        ("logout_blocked", 409),
        ("other_error", 400),
    ]:
        with patch(
            "star_itsm_api.routers.sf_chat.chat_svc.set_presence_online",
            AsyncMock(side_effect=ValueError(exc_msg)),
        ), patch(
            "star_itsm_api.routers.sf_chat.chat_svc.logout_check",
            AsyncMock(return_value=SfChatLogoutCheckRead(can_logout=False, reason="Aktiv chat")),
        ):
            response = await client.put(
                "/api/v1/sf-chat/presence",
                json={"online": False, "force": False},
            )
            assert response.status_code == expected_code


@pytest.mark.asyncio
async def test_presence_heartbeat(
    client: AsyncClient,
) -> None:
    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.heartbeat_presence",
        AsyncMock(),
    ) as mock_heartbeat:
        response = await client.post("/api/v1/sf-chat/presence/heartbeat")
        assert response.status_code == 204
        mock_heartbeat.assert_called_once()


@pytest.mark.asyncio
async def test_presence_logout_check(
    client: AsyncClient,
) -> None:
    check_read = SfChatLogoutCheckRead(can_logout=True)
    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.logout_check",
        AsyncMock(return_value=check_read),
    ):
        response = await client.get("/api/v1/sf-chat/presence/logout-check")
        assert response.status_code == 200
        data = response.json()
        assert data["can_logout"] is True


@pytest.mark.asyncio
async def test_agent_inbox(
    client: AsyncClient,
) -> None:
    inbox_read = SfChatAgentInboxRead(
        items=[],
        online=True,
        notification_count=0,
    )
    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.build_agent_inbox",
        AsyncMock(return_value=inbox_read),
    ):
        response = await client.get("/api/v1/sf-chat/agent/inbox")
        assert response.status_code == 200
        data = response.json()
        assert data["online"] is True


@pytest.mark.asyncio
async def test_start_bot_assistant_success(
    client: AsyncClient,
    sample_session_read: SfChatSessionRead,
) -> None:
    session_id = uuid.uuid4()
    with patch(
        "star_itsm_api.routers.sf_chat.chat_svc.start_bot_assistant_for_session",
        AsyncMock(return_value=sample_session_read),
    ):
        response = await client.post(f"/api/v1/sf-chat/sessions/{session_id}/start-bot")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(sample_session_read.id)


@pytest.mark.asyncio
async def test_start_bot_assistant_failures(
    client: AsyncClient,
) -> None:
    session_id = uuid.uuid4()
    for exc_msg, expected_code in [
        ("not_sf_member", 403),
        ("session_not_found", 404),
        ("not_waiting", 409),
        ("other_error", 400),
    ]:
        with patch(
            "star_itsm_api.routers.sf_chat.chat_svc.start_bot_assistant_for_session",
            AsyncMock(side_effect=ValueError(exc_msg)),
        ):
            response = await client.post(f"/api/v1/sf-chat/sessions/{session_id}/start-bot")
            assert response.status_code == expected_code
