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
    captured_urls: list[str] = []

    async def fake_post_openai(
        url: str,
        headers: dict[str, str],
        messages: list[dict[str, str]],
        model: str,
    ) -> str:
        captured_urls.append(url)
        return "Svar fra OpenAI"

    with patch.dict("os.environ", {"OPENAI_API_KEY": "env-key"}, clear=True):
        payload = {
            "messages": [{"role": "user", "content": "Hej"}],
            "model_override": "gpt-4o",
            "openai_key": "client-supplied-key",
            "custom_router_url": "https://evil.example.com/v1/chat/completions",
        }
        with patch("star_itsm_api.routers.chat._post_openai_chat", fake_post_openai):
            response = await client.post("/api/v1/chat", json=payload)

    assert response.status_code == 200
    assert captured_urls
    assert any("api.openai.com" in url for url in captured_urls)
    assert not any("evil.example.com" in url for url in captured_urls)
    assert "Svar fra OpenAI" in response.json()["response"]


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


@pytest.mark.asyncio
async def test_gemini_error_response_never_leaks_api_key(client: AsyncClient) -> None:
    """FINDING-108 — upstream failures must not expose GOOGLE_KEY in chat body."""
    leaked_key = "AIzaSy-FAKE-LEAK-TEST-KEY-1234567890"
    with patch.dict("os.environ", {"GOOGLE_KEY": leaked_key}, clear=False):
        original_post = AsyncClient.post

        async def boom_on_gemini(self, url, *args, **kwargs):
            if "generativelanguage.googleapis.com" in str(url):
                raise RuntimeError(
                    f"Client error '404 Not Found' for url "
                    f"'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={leaked_key}'"
                )
            return await original_post(self, url, *args, **kwargs)

        with patch("star_itsm_api.routers.chat.httpx.AsyncClient.post", boom_on_gemini):
            with patch(
                "star_itsm_api.routers.chat.get_smart_mock_response",
                AsyncMock(return_value="Simuleret svar."),
            ):
                response = await client.post(
                    "/api/v1/chat",
                    json={"messages": [{"role": "user", "content": "Hej"}]},
                )

    assert response.status_code == 200
    body = response.json()["response"]
    assert leaked_key not in body
    assert "key=" not in body.lower()
    assert "generativelanguage.googleapis.com" not in body


def test_sanitize_client_error_message_redacts_secrets() -> None:
    from star_itsm_api.routers.chat import _sanitize_client_error_message

    raw = (
        "404 for https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=SECRET123"
    )
    cleaned = _sanitize_client_error_message(RuntimeError(raw))
    assert "SECRET123" not in cleaned
    assert "generativelanguage.googleapis.com" not in cleaned
    assert "[upstream-api-endpoint]" in cleaned
