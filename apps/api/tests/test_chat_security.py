"""Regression tests for chat/MCP security fixes (@fix-chatbot)."""

import uuid
from collections.abc import AsyncIterator
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient, Response

from star_itsm_api.core.security import get_current_user, get_current_user_session
from star_itsm_api.main import app
from star_itsm_api.routers.chat import execute_tool


FAKE_SUBMITTER = SimpleNamespace(
    id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
    email="sf01@example.dk",
    display_name="Anna Borger",
    role="end_user",
    is_active=True,
    password_hash=None,
    deleted_at=None,
    must_change_password=False,
)

FAKE_AGENT = SimpleNamespace(
    id=uuid.UUID("00000000-0000-0000-0000-000000000002"),
    email="agent@example.dk",
    display_name="Agent Test",
    role="agent",
    is_active=True,
    password_hash=None,
    deleted_at=None,
    must_change_password=False,
)


@pytest.fixture
async def unauthenticated_client(override_db: AsyncMock) -> AsyncIterator[AsyncClient]:
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_session, None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    from tests.conftest import _fake_admin_user, _fake_admin_session

    app.dependency_overrides[get_current_user] = _fake_admin_user
    app.dependency_overrides[get_current_user_session] = _fake_admin_session


@pytest.fixture
def as_submitter() -> AsyncIterator[None]:
    app.dependency_overrides[get_current_user] = lambda: FAKE_SUBMITTER
    app.dependency_overrides[get_current_user_session] = lambda: FAKE_SUBMITTER
    yield
    from tests.conftest import _fake_admin_user, _fake_admin_session

    app.dependency_overrides[get_current_user] = _fake_admin_user
    app.dependency_overrides[get_current_user_session] = _fake_admin_session


@pytest.mark.asyncio
async def test_chat_unauthenticated_returns_401(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.post(
        "/api/v1/chat",
        json={"messages": [{"role": "user", "content": "Hej"}]},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_chat_ignores_spoofed_user_email_in_body(client: AsyncClient, as_submitter: None) -> None:
    with patch.dict("os.environ", {}, clear=True):
        with patch(
            "star_itsm_api.routers.chat.get_user_tickets",
            AsyncMock(return_value="Sagsnr: 12345 (Aktiv)"),
        ) as mock_tickets:
            response = await client.post(
                "/api/v1/chat",
                json={
                    "messages": [{"role": "user", "content": "mine sager"}],
                    "user_email": "admin@example.dk",
                },
            )
    assert response.status_code == 200
    mock_tickets.assert_called_once_with("sf01@example.dk", caller=FAKE_SUBMITTER)


@pytest.mark.asyncio
async def test_chat_request_rejects_client_api_keys(client: AsyncClient) -> None:
    """Client-supplied secret fields are ignored; env keys and no SSRF to client URL."""
    with patch.dict("os.environ", {"OPENAI_API_KEY": "env-key"}, clear=True):
        payload = {
            "messages": [{"role": "user", "content": "Hej"}],
            "model_override": "gpt-4o",
            "openai_key": "client-supplied-key",
            "custom_router_url": "https://evil.example.com/v1/chat/completions",
        }
        mock_res_json = {"choices": [{"message": {"content": "Svar fra OpenAI"}}]}
        original_post = AsyncClient.post
        captured_urls: list[str] = []

        async def mock_post_fn(self, url, *args, **kwargs):
            captured_urls.append(str(url))
            if "api.openai.com" in str(url):
                import httpx as httpx_mod
                req = httpx_mod.Request("POST", url)
                return Response(200, json=mock_res_json, request=req)
            return await original_post(self, url, *args, **kwargs)

        with patch("httpx.AsyncClient.post", mock_post_fn):
            response = await client.post("/api/v1/chat", json=payload)

    assert response.status_code == 200
    assert any("api.openai.com" in url for url in captured_urls)
    assert not any("evil.example.com" in url for url in captured_urls)


@pytest.mark.asyncio
async def test_execute_tool_create_ticket_uses_caller_not_body_email() -> None:
    with patch(
        "star_itsm_api.routers.chat.create_ticket",
        AsyncMock(return_value="Oprettet INC-2026-00001"),
    ) as mock_create:
        result = await execute_tool(
            "create_ticket",
            {
                "user_email": "admin@example.dk",
                "title": "Test sag",
                "description": "Dette er en test beskrivelse",
            },
            FAKE_SUBMITTER,
        )
    assert "Oprettet" in result
    mock_create.assert_called_once()
    call_kwargs = mock_create.call_args.kwargs
    assert call_kwargs["user_email"] == "sf01@example.dk"
    assert call_kwargs["caller"] is FAKE_SUBMITTER


@pytest.mark.asyncio
async def test_execute_tool_update_status_non_staff_denied() -> None:
    with patch(
        "star_itsm_api.routers.chat.update_ticket_status",
        AsyncMock(return_value="should not reach"),
    ) as mock_update:
        result = await execute_tool(
            "update_ticket_status",
            {
                "ticket_number": "INC-2026-00001",
                "status": "closed",
                "actor_email": "admin@example.dk",
            },
            FAKE_SUBMITTER,
        )
    assert "medarbejdere" in result.lower()
    mock_update.assert_not_called()
