from datetime import UTC, datetime
import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from cryptography.fernet import Fernet

from star_itsm_api.core.config import settings
from star_itsm_api.models.email_integration import EmailIntegration
from star_itsm_api.services.gmail import (
    GmailApiError,
    InboundEmailMessage,
    assert_connected_mailbox_allowed,
    build_oauth_authorize_url,
    build_outbound_from_address,
    build_reply_subject,
    build_ticket_description_from_email,
    create_oauth_state,
    decrypt_refresh_token,
    disconnect_gmail,
    encrypt_refresh_token,
    exchange_oauth_code,
    fetch_profile_email,
    get_email_integration,
    normalize_ticket_title_from_subject,
    parse_gmail_message,
    parse_oauth_state,
    refresh_access_token,
    save_gmail_preferences,
    upsert_email_integration,
    _gmail_history_ids,
    _message_targets_sync_mailbox,
)


def _b64(value: str) -> str:
    import base64

    return base64.urlsafe_b64encode(value.encode("utf-8")).decode("utf-8")


def test_thread_message_parsing_extracts_ids_and_body() -> None:
    payload = {
        "id": "gmail-123",
        "threadId": "thread-999",
        "internalDate": "1710000000000",
        "payload": {
            "mimeType": "multipart/alternative",
            "headers": [
                {"name": "From", "value": "Kunde <kunde@example.com>"},
                {"name": "To", "value": "support@example.dk"},
                {"name": "Subject", "value": "Re: Netværk nede"},
                {"name": "Message-Id", "value": "<abc@example.com>"},
                {"name": "In-Reply-To", "value": "<prior@example.com>"},
            ],
            "parts": [
                {"mimeType": "text/plain", "body": {"data": _b64("Hej\nDet virker ikke endnu")}},
            ],
        },
    }

    parsed = parse_gmail_message(payload)

    assert parsed is not None
    assert parsed.gmail_message_id == "gmail-123"
    assert parsed.gmail_thread_id == "thread-999"
    assert parsed.from_email == "kunde@example.com"
    assert "virker ikke" in parsed.body_text


def test_ticket_creation_payload_uses_email_content() -> None:
    message = InboundEmailMessage(
        gmail_message_id="m1",
        gmail_thread_id="t1",
        internet_message_id="<m1@example.com>",
        subject="Re: [INC-2026-00001] Printer virker ikke",
        from_email="kunde@example.com",
        to_email="support@example.dk",
        body_text="Printeren står stadig fast i fejltilstand.",
        received_at=datetime.now(UTC),
        in_reply_to=None,
        references=None,
    )

    title = normalize_ticket_title_from_subject(message.subject)
    description = build_ticket_description_from_email(message)

    assert title == "[INC-2026-00001] Printer virker ikke"
    assert "E-mail modtaget fra kunde@example.com" in description
    assert "Printeren står stadig fast" in description


def test_reply_subject_includes_ticket_number() -> None:
    subject = build_reply_subject("INC-2026-00042", "Driftforstyrrelse i kasse 3")
    assert subject.startswith("Re: [INC-2026-00042]")


def test_outbound_from_uses_display_name_and_connected_email() -> None:
    header = build_outbound_from_address(connected_email="proto.star.itsm@gmail.com")
    assert "STAR Service Desk" in header
    assert "proto.star.itsm@gmail.com" in header


def test_connected_mailbox_validation(monkeypatch) -> None:
    from star_itsm_api.core import config

    monkeypatch.setattr(config.settings, "gmail_sync_from_email", "proto.star.itsm@gmail.com")
    assert_connected_mailbox_allowed("proto.star.itsm@gmail.com")
    try:
        assert_connected_mailbox_allowed("other@gmail.com")
    except GmailApiError:
        pass
    else:
        raise AssertionError("expected GmailApiError for wrong mailbox")


class _FakeResponse:
    def __init__(self, status_code: int, data: dict | None = None, text: str = ""):
        self.status_code = status_code
        self._data = data or {}
        self.text = text

    def json(self) -> dict:
        return self._data


class _FakeAsyncClient:
    def __init__(self, *, response: _FakeResponse):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, *args, **kwargs):  # noqa: ANN002, ANN003
        await asyncio.sleep(0)
        return self._response

    async def get(self, *args, **kwargs):  # noqa: ANN002, ANN003
        await asyncio.sleep(0)
        return self._response


@pytest.fixture
def gmail_oauth_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "google_client_id", "google-client-id")
    monkeypatch.setattr(settings, "google_client_secret", "google-client-secret")
    monkeypatch.setattr(settings, "gmail_redirect_uri", "https://app.example.dk/gmail/callback")
    monkeypatch.setattr(settings, "jwt_secret", "test-jwt-secret-for-gmail-oauth-tests")


def test_message_targets_sync_mailbox_respects_configured_address(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gmail_sync_from_email", "support@example.dk")
    message = InboundEmailMessage(
        gmail_message_id="m1",
        gmail_thread_id="t1",
        internet_message_id=None,
        subject="Test",
        from_email="user@example.dk",
        to_email="Other <other@example.dk>, support@example.dk",
        body_text="Body",
        received_at=datetime.now(UTC),
        in_reply_to=None,
        references=None,
    )
    assert _message_targets_sync_mailbox(message) is True


def test_normalize_ticket_title_strips_reply_prefix() -> None:
    assert normalize_ticket_title_from_subject("Re: Netværk nede") == "Netværk nede"
    assert normalize_ticket_title_from_subject("SV: Printer") == "Printer"
    assert normalize_ticket_title_from_subject("   ") == "Ny e-mail sag"


def test_build_reply_subject_handles_empty_and_existing_re() -> None:
    assert build_reply_subject("INC-1", "") == "Re: [INC-1]"
    assert build_reply_subject("INC-1", "Re: Drift").startswith("Re:")


def test_parse_gmail_message_returns_none_without_ids() -> None:
    assert parse_gmail_message({"payload": {"headers": []}}) is None


def test_parse_gmail_message_prefers_html_when_no_plain_text() -> None:
    payload = {
        "id": "g1",
        "threadId": "t1",
        "internalDate": "1710000000000",
        "payload": {
            "mimeType": "text/html",
            "headers": [{"name": "From", "value": "a@b.dk"}],
            "body": {"data": _b64("<p>Hej&nbsp;verden</p>")},
        },
    }
    parsed = parse_gmail_message(payload)
    assert parsed is not None
    assert "Hej verden" in parsed.body_text


def test_encrypt_and_decrypt_refresh_token_plaintext(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gmail_token_encryption_key", None)
    monkeypatch.setattr(settings, "gmail_allow_plaintext_tokens", True)
    stored = encrypt_refresh_token("refresh-token-123")
    assert stored.startswith("plain:")
    assert decrypt_refresh_token(stored) == "refresh-token-123"


def test_encrypt_and_decrypt_refresh_token_fernet(monkeypatch: pytest.MonkeyPatch) -> None:
    key = Fernet.generate_key().decode("utf-8")
    monkeypatch.setattr(settings, "gmail_token_encryption_key", key)
    stored = encrypt_refresh_token("secret-refresh")
    assert stored.startswith("enc:")
    assert decrypt_refresh_token(stored) == "secret-refresh"


def test_create_and_parse_oauth_state_roundtrip(gmail_oauth_env: None) -> None:
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    state = create_oauth_state(org_id=org_id, user_id=user_id)
    parsed_org, parsed_user = parse_oauth_state(state)
    assert parsed_org == org_id
    assert parsed_user == user_id


def test_build_oauth_authorize_url_contains_google_params(gmail_oauth_env: None) -> None:
    url = build_oauth_authorize_url(state="state-token")
    assert "accounts.google.com/o/oauth2/v2/auth" in url
    assert "client_id=google-client-id" in url
    assert "state=state-token" in url


@pytest.mark.asyncio
async def test_exchange_oauth_code_success(monkeypatch: pytest.MonkeyPatch, gmail_oauth_env: None) -> None:
    import star_itsm_api.services.gmail as gmail_service

    response = _FakeResponse(
        200,
        {"access_token": "access-1", "refresh_token": "refresh-1"},
    )
    monkeypatch.setattr(
        gmail_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(response=response),
    )
    access, refresh = await exchange_oauth_code("oauth-code")
    assert access == "access-1"
    assert refresh == "refresh-1"


@pytest.mark.asyncio
async def test_refresh_access_token_success(monkeypatch: pytest.MonkeyPatch, gmail_oauth_env: None) -> None:
    import star_itsm_api.services.gmail as gmail_service

    monkeypatch.setattr(settings, "gmail_allow_plaintext_tokens", True)
    integration = EmailIntegration(
        organization_id=uuid.uuid4(),
        provider="gmail",
        refresh_token_encrypted="plain:stored-refresh",
    )
    response = _FakeResponse(200, {"access_token": "new-access"})
    monkeypatch.setattr(
        gmail_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(response=response),
    )
    token = await refresh_access_token(integration)
    assert token == "new-access"


@pytest.mark.asyncio
async def test_fetch_profile_email(monkeypatch: pytest.MonkeyPatch) -> None:
    with patch(
        "star_itsm_api.services.gmail._gmail_get_json",
        new_callable=AsyncMock,
        return_value={"emailAddress": "desk@example.dk"},
    ):
        email = await fetch_profile_email("access-token")
    assert email == "desk@example.dk"


@pytest.mark.asyncio
async def test_get_email_integration_none() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)
    assert await get_email_integration(mock_db, organization_id=uuid.uuid4()) is None


@pytest.mark.asyncio
async def test_upsert_email_integration_creates_row(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gmail_allow_plaintext_tokens", True)
    org_id = uuid.uuid4()
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    integration = await upsert_email_integration(
        mock_db,
        organization_id=org_id,
        connected_email="desk@example.dk",
        refresh_token="refresh-new",
    )
    assert integration.connected_email == "desk@example.dk"
    mock_db.add.assert_called_once()


@pytest.mark.asyncio
async def test_save_gmail_preferences_and_disconnect() -> None:
    org_id = uuid.uuid4()
    integration = EmailIntegration(organization_id=org_id, provider="gmail", enabled=True)
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = integration
    mock_db.execute = AsyncMock(return_value=mock_result)

    saved = await save_gmail_preferences(mock_db, organization_id=org_id, enabled=False)
    assert saved.enabled is False

    await disconnect_gmail(mock_db, organization_id=org_id)
    assert integration.connected_email is None
    assert integration.refresh_token_encrypted is None


@pytest.mark.asyncio
async def test_gmail_history_ids_returns_empty_on_404() -> None:
    with patch(
        "star_itsm_api.services.gmail._gmail_get_json",
        new_callable=AsyncMock,
        side_effect=GmailApiError("Gmail API GET failed (404): not found"),
    ):
        ids, history = await _gmail_history_ids("token", "123")
    assert ids == []
    assert history is None

