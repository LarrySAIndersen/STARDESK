"""Batch 15 — Help-a-bot short commands and chat message archive endpoints."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from star_itsm_api.models.chatbot_message import ChatbotMessage
from star_itsm_api.routers.chat import (
    ChatPageContext,
    ChatRequest,
    build_chat_system_prompt,
    execute_tool,
    try_page_context_command,
    try_short_command,
)
from tests.conftest import FAKE_ADMIN


@pytest.mark.asyncio
async def test_try_short_command_close_ticket_with_note() -> None:
    with patch(
        "star_itsm_api.routers.chat.update_ticket_status",
        new_callable=AsyncMock,
        return_value="Sag lukket",
    ) as mock_update:
        result = await try_short_command(
            "luk sag INC-2026-00042 - Kunden bekræftede løsning",
            FAKE_ADMIN,
        )
    assert result == "Sag lukket"
    mock_update.assert_awaited_once_with(
        ticket_number="INC-2026-00042",
        status="closed",
        actor_email="admin@example.dk",
        note="Kunden bekræftede løsning",
        caller=FAKE_ADMIN,
    )


@pytest.mark.asyncio
async def test_try_short_command_resolve_ticket() -> None:
    with patch(
        "star_itsm_api.routers.chat.update_ticket_status",
        new_callable=AsyncMock,
        return_value="Sag løst",
    ) as mock_update:
        result = await try_short_command(
            "løs INC-2026-00042",
            FAKE_ADMIN,
        )
    assert result == "Sag løst"
    mock_update.assert_awaited_once_with(
        ticket_number="INC-2026-00042",
        status="resolved",
        actor_email="admin@example.dk",
        note=None,
        caller=FAKE_ADMIN,
    )


@pytest.mark.asyncio
async def test_try_short_command_lookup_ticket() -> None:
    with patch(
        "star_itsm_api.routers.chat.get_ticket_by_number",
        new_callable=AsyncMock,
        return_value="INC-2026-00042: Printer fejl",
    ) as mock_lookup:
        result = await try_short_command("INC-2026-00042", FAKE_ADMIN)
    assert "INC-2026-00042" in (result or "")
    mock_lookup.assert_awaited_once_with("INC-2026-00042", caller=FAKE_ADMIN)


@pytest.mark.asyncio
async def test_try_short_command_mine_sager() -> None:
    with patch(
        "star_itsm_api.routers.chat.get_user_tickets",
        new_callable=AsyncMock,
        return_value="INC-2026-00001 (new)",
    ) as mock_tickets:
        result = await try_short_command("mine sager", FAKE_ADMIN)
    assert result is not None
    assert "INC-2026-00001" in result
    mock_tickets.assert_awaited_once_with("admin@example.dk", caller=FAKE_ADMIN)


@pytest.mark.asyncio
async def test_try_short_command_opret_sag_with_dash() -> None:
    with patch(
        "star_itsm_api.routers.chat.create_ticket",
        new_callable=AsyncMock,
        return_value="Oprettet INC-2026-00099",
    ) as mock_create:
        result = await try_short_command(
            "opret: Printer fejl - Den udskriver kun tomme sider",
            FAKE_ADMIN,
        )
    assert result == "Oprettet INC-2026-00099"
    mock_create.assert_awaited_once_with(
        title="Printer fejl",
        description="Den udskriver kun tomme sider",
        caller=FAKE_ADMIN,
    )


@pytest.mark.asyncio
async def test_try_short_command_returns_none_for_empty() -> None:
    assert await try_short_command("", FAKE_ADMIN) is None


@pytest.mark.asyncio
async def test_execute_tool_unknown_name() -> None:
    result = await execute_tool("missing_tool", {}, FAKE_ADMIN)
    assert "findes ikke" in result


@pytest.mark.asyncio
async def test_execute_tool_get_ticket_categories() -> None:
    with patch(
        "star_itsm_api.routers.chat.get_ticket_categories",
        new_callable=AsyncMock,
        return_value="IT-Support",
    ) as mock_cats:
        result = await execute_tool("get_ticket_categories", {}, FAKE_ADMIN)
    assert result == "IT-Support"
    mock_cats.assert_awaited_once()


@pytest.mark.asyncio
async def test_execute_tool_get_user_tickets() -> None:
    with patch(
        "star_itsm_api.routers.chat.get_user_tickets",
        new_callable=AsyncMock,
        return_value="INC-1",
    ) as mock_tickets:
        result = await execute_tool("get_user_tickets", {}, FAKE_ADMIN)
    assert result == "INC-1"
    mock_tickets.assert_awaited_once_with("admin@example.dk", caller=FAKE_ADMIN)


@pytest.mark.asyncio
async def test_execute_tool_handles_exception() -> None:
    with patch(
        "star_itsm_api.routers.chat.search_knowledge_articles",
        new_callable=AsyncMock,
        side_effect=RuntimeError("db down"),
    ):
        result = await execute_tool("search_knowledge_articles", {"query": "vpn"}, FAKE_ADMIN)
    assert "Fejl under kørsel" in result


@pytest.mark.asyncio
async def test_get_smart_mock_uses_short_command(api_client: AsyncClient) -> None:
    with patch.dict("os.environ", {}, clear=True):
        with (
            patch(
                "star_itsm_api.routers.chat.try_short_command",
                new_callable=AsyncMock,
                return_value="Kort svar fra short command",
            ),
            patch(
                "star_itsm_api.routers.chat.log_chatbot_message",
                new_callable=AsyncMock,
            ),
        ):
            response = await api_client.post(
                "/api/v1/chat",
                json={
                    "messages": [{"role": "user", "content": "luk INC-2026-00042"}],
                },
            )
    assert response.status_code == 200
    assert response.json()["response"] == "Kort svar fra short command"


@pytest.mark.asyncio
async def test_chat_messages_list_with_user_filter(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    user_id = FAKE_ADMIN.id
    msg = ChatbotMessage(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        user_id=user_id,
        sender="user",
        sender_name="Anna",
        body="VPN hjælp",
        category="Support",
        ticket_ref=None,
        is_bookmarked=False,
        created_at=datetime.now(UTC),
    )

    scalars = MagicMock()
    scalars.all.return_value = [msg]
    execute_result = MagicMock()
    execute_result.scalars.return_value = scalars
    override_db.execute = AsyncMock(return_value=execute_result)

    response = await api_client.get(
        "/api/v1/chat/messages",
        params={"q": "vpn"},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["body"] == "VPN hjælp"


@pytest.mark.asyncio
async def test_chat_toggle_bookmark_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    msg_id = uuid.uuid4()
    msg = ChatbotMessage(
        id=msg_id,
        session_id=uuid.uuid4(),
        user_id=FAKE_ADMIN.id,
        sender="user",
        sender_name="Anna",
        body="Hej",
        category="Support",
        is_bookmarked=False,
        created_at=datetime.now(UTC),
    )
    override_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: msg))

    response = await api_client.post(f"/api/v1/chat/messages/{msg_id}/bookmark")

    assert response.status_code == 200
    assert response.json()["is_bookmarked"] is True
    override_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_chat_toggle_bookmark_invalid_id(api_client: AsyncClient) -> None:
    response = await api_client.post("/api/v1/chat/messages/not-a-uuid/bookmark")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_chat_delete_message_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    msg_id = uuid.uuid4()
    msg = ChatbotMessage(
        id=msg_id,
        session_id=uuid.uuid4(),
        user_id=FAKE_ADMIN.id,
        sender="user",
        sender_name="Anna",
        body="Hej",
        category="Support",
        is_bookmarked=False,
        created_at=datetime.now(UTC),
    )
    override_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: msg))
    override_db.delete = AsyncMock()

    response = await api_client.delete(f"/api/v1/chat/messages/{msg_id}")

    assert response.status_code == 200
    assert response.json()["success"] is True
    override_db.delete.assert_awaited_once_with(msg)


@pytest.mark.asyncio
async def test_chat_delete_session_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    session_id = uuid.uuid4()
    delete_result = MagicMock()
    delete_result.rowcount = 2
    override_db.execute = AsyncMock(return_value=delete_result)

    response = await api_client.delete(f"/api/v1/chat/sessions/{session_id}")

    assert response.status_code == 200
    assert response.json()["success"] is True


@pytest.mark.asyncio
async def test_get_smart_mock_response_categories() -> None:
    from star_itsm_api.routers.chat import get_smart_mock_response

    request = ChatRequest(
        messages=[{"role": "user", "content": "vis kategorier"}],
    )
    with patch(
        "star_itsm_api.routers.chat.get_ticket_categories",
        new_callable=AsyncMock,
        return_value="Kategori: IT",
    ):
        response = await get_smart_mock_response(request, FAKE_ADMIN)
    assert "IT" in response


@pytest.mark.asyncio
async def test_try_short_command_close_prefix() -> None:
    with patch(
        "star_itsm_api.routers.chat.update_ticket_status",
        new_callable=AsyncMock,
        return_value="Lukket",
    ) as mock_update:
        result = await try_short_command(
            "close INC-2026-00001",
            FAKE_ADMIN,
        )
    assert result == "Lukket"
    mock_update.assert_awaited_once()


@pytest.mark.asyncio
async def test_execute_tool_get_ticket_by_number() -> None:
    with patch(
        "star_itsm_api.routers.chat.get_ticket_by_number",
        new_callable=AsyncMock,
        return_value="INC-2026-00001: Printer",
    ) as mock_get:
        result = await execute_tool("get_ticket_by_number", {"ticket_number": "INC-2026-00001"}, FAKE_ADMIN)
    assert "INC-2026-00001" in result
    mock_get.assert_awaited_once_with("INC-2026-00001", caller=FAKE_ADMIN)


@pytest.mark.asyncio
async def test_execute_tool_update_ticket_status() -> None:
    with patch(
        "star_itsm_api.routers.chat.update_ticket_status",
        new_callable=AsyncMock,
        return_value="Status opdateret",
    ) as mock_update:
        result = await execute_tool(
            "update_ticket_status",
            {
                "ticket_number": "INC-2026-00001",
                "status": "resolved",
            },
            FAKE_ADMIN,
        )
    assert result == "Status opdateret"
    mock_update.assert_awaited_once()


@pytest.mark.asyncio
async def test_chat_toggle_bookmark_not_found(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    msg_id = uuid.uuid4()
    override_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
    response = await api_client.post(f"/api/v1/chat/messages/{msg_id}/bookmark")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_chat_messages_only_bookmarked_filter(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    scalars = MagicMock()
    scalars.all.return_value = []
    override_db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: scalars))
    response = await api_client.get(
        "/api/v1/chat/messages",
        params={"only_bookmarked": "true", "category": "VPN"},
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_try_page_context_command_summarize_ticket() -> None:
    page_context = ChatPageContext(
        page_path="/tickets/abc",
        page_label="Sagsdetaljer",
        ticket_number="INC-2026-00118",
        ticket_title="Printer fejl",
    )
    with patch(
        "star_itsm_api.routers.chat.get_ticket_by_number",
        new_callable=AsyncMock,
        return_value="INC-2026-00118: Printer fejl",
    ) as mock_lookup:
        result = await try_page_context_command("Opsummer denne sag", page_context, FAKE_ADMIN)
    assert result is not None
    assert "opsummering" in result.lower()
    mock_lookup.assert_awaited_once_with("INC-2026-00118", caller=FAKE_ADMIN)


@pytest.mark.asyncio
async def test_try_page_context_command_ignores_without_ticket() -> None:
    result = await try_page_context_command(
        "Opsummer denne sag",
        ChatPageContext(page_path="/tickets", page_label="Alle sager"),
        FAKE_ADMIN,
    )
    assert result is None


def test_build_chat_system_prompt_includes_page_context() -> None:
    prompt = build_chat_system_prompt(
        "Anna",
        ChatPageContext(
            page_path="/tickets/abc",
            page_label="Sagsdetaljer",
            ticket_number="INC-2026-00118",
            ticket_title="Printer fejl",
        ),
    )
    assert "Sagsdetaljer" in prompt
    assert "INC-2026-00118" in prompt
    assert "Printer fejl" in prompt


@pytest.mark.asyncio
async def test_chat_delete_session_invalid_id(api_client: AsyncClient) -> None:
    response = await api_client.delete("/api/v1/chat/sessions/not-a-uuid")
    assert response.status_code == 400
