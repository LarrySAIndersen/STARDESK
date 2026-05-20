from __future__ import annotations

import base64
import binascii
import email.utils
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from html import unescape
from urllib.parse import urlencode

import httpx
import jwt
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.config import settings
from star_itsm_api.models.email_integration import EmailIntegration
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_email import TicketEmail
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.models.user import User
from star_itsm_api.services.org_access import get_user_organization_id
from star_itsm_api.services.routing import apply_routing
from star_itsm_api.services.sla import apply_sla_to_ticket
from star_itsm_api.services.ticket_numbers import generate_ticket_number

GOOGLE_OAUTH_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_OAUTH_TOKEN = "https://oauth2.googleapis.com/token"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"
GMAIL_SCOPES = (
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
)
MAX_SYNC_MESSAGES = 50
DEFAULT_FROM_DISPLAY = "STAR Service Desk / STARdesk"


class GmailApiError(RuntimeError):
    pass


@dataclass(slots=True)
class InboundEmailMessage:
    gmail_message_id: str
    gmail_thread_id: str
    internet_message_id: str | None
    subject: str
    from_email: str | None
    to_email: str | None
    body_text: str
    received_at: datetime
    in_reply_to: str | None
    references: str | None


@dataclass(slots=True)
class GmailSyncStats:
    processed: int = 0
    created_tickets: int = 0
    appended_to_threads: int = 0
    skipped_duplicates: int = 0


def _normalize_email(value: str | None) -> str:
    raw = (value or "").strip().lower()
    if not raw:
        return ""
    parsed = email.utils.parseaddr(raw)
    return (parsed[1] or raw).lower()


def _expected_sync_email() -> str | None:
    expected = (settings.gmail_sync_from_email or "").strip()
    return expected.lower() if expected else None


def assert_connected_mailbox_allowed(connected_email: str) -> None:
    expected = _expected_sync_email()
    if not expected:
        return
    actual = _normalize_email(connected_email)
    if actual != expected:
        raise GmailApiError(
            f"Forbundet Gmail-konto skal være {expected} (modtaget: {connected_email or 'ukendt'})."
        )


def _message_targets_sync_mailbox(message: InboundEmailMessage) -> bool:
    expected = _expected_sync_email()
    if not expected:
        return True
    raw = (message.to_email or "").strip()
    if not raw:
        return True
    for part in raw.split(","):
        if _normalize_email(part.strip()) == expected:
            return True
    return False


def build_outbound_from_address(*, connected_email: str | None) -> str:
    configured = (settings.gmail_default_from or "").strip()
    if configured:
        return configured
    address = (connected_email or _expected_sync_email() or "").strip()
    if not address:
        return f"{DEFAULT_FROM_DISPLAY} <noreply@stardesk.local>"
    if "<" in address and ">" in address:
        return address
    return f"{DEFAULT_FROM_DISPLAY} <{address}>"


def _require_oauth_settings() -> tuple[str, str, str]:
    client_id = (settings.google_client_id or "").strip()
    client_secret = (settings.google_client_secret or "").strip()
    redirect_uri = (settings.gmail_redirect_uri or "").strip()
    if not client_id or not client_secret or not redirect_uri:
        raise GmailApiError("Google OAuth mangler konfiguration i miljøvariabler.")
    return client_id, client_secret, redirect_uri


def _fernet():
    key = (settings.gmail_token_encryption_key or "").strip()
    if not key:
        return None
    try:
        from cryptography.fernet import Fernet
    except Exception as exc:  # pragma: no cover - import failure depends on runtime env
        raise GmailApiError("cryptography mangler; kan ikke kryptere Gmail-token.") from exc
    try:
        return Fernet(key.encode("utf-8"))
    except Exception as exc:
        raise GmailApiError("GMAIL_TOKEN_ENCRYPTION_KEY er ugyldig (forventet Fernet-nøgle).") from exc


def encrypt_refresh_token(token: str) -> str:
    token = token.strip()
    if not token:
        raise GmailApiError("Refresh token mangler.")
    f = _fernet()
    if f is None:
        if settings.gmail_allow_plaintext_tokens:
            return f"plain:{token}"
        raise GmailApiError("Sæt GMAIL_TOKEN_ENCRYPTION_KEY eller GMAIL_ALLOW_PLAINTEXT_TOKENS=1.")
    encrypted = f.encrypt(token.encode("utf-8")).decode("utf-8")
    return f"enc:{encrypted}"


def decrypt_refresh_token(value: str | None) -> str:
    encoded = (value or "").strip()
    if not encoded:
        raise GmailApiError("Intet refresh token gemt.")
    if encoded.startswith("plain:"):
        return encoded[6:]
    if encoded.startswith("enc:"):
        f = _fernet()
        if f is None:
            raise GmailApiError("Refresh token er krypteret, men GMAIL_TOKEN_ENCRYPTION_KEY mangler.")
        return f.decrypt(encoded[4:].encode("utf-8")).decode("utf-8")
    if settings.gmail_allow_plaintext_tokens:
        return encoded
    raise GmailApiError("Ukendt tokenformat i email_integrations.")


def create_oauth_state(*, org_id: uuid.UUID, user_id: uuid.UUID) -> str:
    if not settings.jwt_secret:
        raise GmailApiError("JWT_SECRET mangler; kan ikke starte Gmail OAuth.")
    payload = {
        "org_id": str(org_id),
        "user_id": str(user_id),
        "purpose": "gmail_oauth",
        "exp": datetime.now(UTC) + timedelta(minutes=10),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def parse_oauth_state(state: str) -> tuple[uuid.UUID, uuid.UUID]:
    if not settings.jwt_secret:
        raise GmailApiError("JWT_SECRET mangler; kan ikke validere Gmail OAuth state.")
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("purpose") != "gmail_oauth":
            raise GmailApiError("Ugyldig Gmail OAuth state.")
        return uuid.UUID(str(payload["org_id"])), uuid.UUID(str(payload["user_id"]))
    except (KeyError, ValueError, jwt.PyJWTError) as exc:
        raise GmailApiError("Ugyldig eller udløbet Gmail OAuth state.") from exc


def build_oauth_authorize_url(*, state: str) -> str:
    client_id, _client_secret, redirect_uri = _require_oauth_settings()
    query = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(GMAIL_SCOPES),
            "access_type": "offline",
            "include_granted_scopes": "true",
            "prompt": "consent",
            "state": state,
        }
    )
    return f"{GOOGLE_OAUTH_AUTHORIZE}?{query}"


async def get_email_integration(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
) -> EmailIntegration | None:
    result = await db.execute(
        select(EmailIntegration).where(
            EmailIntegration.organization_id == organization_id,
            EmailIntegration.provider == "gmail",
        )
    )
    return result.scalar_one_or_none()


async def exchange_oauth_code(code: str) -> tuple[str, str | None]:
    client_id, client_secret, redirect_uri = _require_oauth_settings()
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            GOOGLE_OAUTH_TOKEN,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if response.status_code >= 400:
        raise GmailApiError("Google OAuth token exchange fejlede.")
    data = response.json()
    refresh_token = str(data.get("refresh_token") or "").strip()
    access_token = str(data.get("access_token") or "").strip()
    if not access_token:
        raise GmailApiError("Google OAuth returnerede ikke access token.")
    if not refresh_token:
        # Google may omit refresh token on repeat consent; keep existing token if present.
        return access_token, None
    return access_token, refresh_token


async def refresh_access_token(integration: EmailIntegration) -> str:
    client_id, client_secret, _redirect_uri = _require_oauth_settings()
    refresh_token = decrypt_refresh_token(integration.refresh_token_encrypted)
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            GOOGLE_OAUTH_TOKEN,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
    if response.status_code >= 400:
        raise GmailApiError("Kunne ikke forny Gmail access token.")
    access_token = str(response.json().get("access_token") or "").strip()
    if not access_token:
        raise GmailApiError("Google returnerede ikke access token ved refresh.")
    return access_token


async def fetch_profile_email(access_token: str) -> str:
    data = await _gmail_get_json(access_token, "/users/me/profile")
    email_address = str(data.get("emailAddress") or "").strip().lower()
    if not email_address:
        raise GmailApiError("Kunne ikke hente forbundet Gmail-adresse.")
    return email_address


async def upsert_email_integration(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    connected_email: str,
    refresh_token: str | None,
    existing_refresh_token_encrypted: str | None = None,
) -> EmailIntegration:
    integration = await get_email_integration(db, organization_id=organization_id)
    if integration is None:
        integration = EmailIntegration(
            organization_id=organization_id,
            provider="gmail",
        )
        db.add(integration)
    assert_connected_mailbox_allowed(connected_email)
    integration.connected_email = connected_email
    if refresh_token:
        integration.refresh_token_encrypted = encrypt_refresh_token(refresh_token)
    elif existing_refresh_token_encrypted:
        integration.refresh_token_encrypted = existing_refresh_token_encrypted
    integration.enabled = True
    await db.commit()
    await db.refresh(integration)
    return integration


async def save_gmail_preferences(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    enabled: bool | None,
) -> EmailIntegration:
    integration = await get_email_integration(db, organization_id=organization_id)
    if integration is None:
        integration = EmailIntegration(
            organization_id=organization_id,
            provider="gmail",
            enabled=False,
        )
        db.add(integration)
    if enabled is not None:
        integration.enabled = enabled
    await db.commit()
    await db.refresh(integration)
    return integration


async def disconnect_gmail(db: AsyncSession, *, organization_id: uuid.UUID) -> None:
    integration = await get_email_integration(db, organization_id=organization_id)
    if integration is None:
        return
    integration.enabled = False
    integration.connected_email = None
    integration.refresh_token_encrypted = None
    integration.last_history_id = None
    await db.commit()


def normalize_ticket_title_from_subject(subject: str) -> str:
    title = re.sub(r"^\s*(re|fwd?|sv)\s*:\s*", "", subject.strip(), flags=re.IGNORECASE)
    title = re.sub(r"\s+", " ", title).strip()
    return title or "Ny e-mail sag"


def build_ticket_description_from_email(message: InboundEmailMessage) -> str:
    sender = message.from_email or "ukendt afsender"
    return (
        f"E-mail modtaget fra {sender}\n"
        f"Emne: {message.subject or 'Ingen emnelinje'}\n\n"
        f"{(message.body_text or '').strip()}"
    ).strip()


def build_reply_subject(ticket_number: str, original_subject: str | None) -> str:
    base = (original_subject or "").strip()
    prefix = f"[{ticket_number}]"
    if not base:
        return f"Re: {prefix}"
    if prefix.lower() not in base.lower():
        base = f"{prefix} {base}"
    if base.lower().startswith("re:"):
        return base
    return f"Re: {base}"


def _parse_email_address(raw: str | None) -> str | None:
    if not raw:
        return None
    _name, addr = email.utils.parseaddr(raw)
    clean = (addr or raw).strip().lower()
    return clean or None


def _decode_base64url(data: str | None) -> str:
    if not data:
        return ""
    try:
        padding = "=" * ((4 - len(data) % 4) % 4)
        decoded = base64.urlsafe_b64decode((data + padding).encode("utf-8"))
        return decoded.decode("utf-8", errors="replace")
    except (binascii.Error, ValueError):
        return ""


def _payload_body_text(payload: dict) -> str:
    mime_type = str(payload.get("mimeType") or "")
    body = payload.get("body") or {}
    data = _decode_base64url(body.get("data"))
    if mime_type == "text/plain" and data.strip():
        return data
    parts = payload.get("parts") or []
    for part in parts:
        nested = _payload_body_text(part)
        if nested.strip():
            return nested
    if mime_type == "text/html" and data.strip():
        stripped = re.sub(r"<[^>]+>", " ", data)
        return re.sub(r"\s+", " ", unescape(stripped)).strip()
    return data


def parse_gmail_message(message_json: dict) -> InboundEmailMessage | None:
    payload = message_json.get("payload") or {}
    headers = {
        str(h.get("name") or "").lower(): str(h.get("value") or "")
        for h in (payload.get("headers") or [])
    }
    gmail_message_id = str(message_json.get("id") or "").strip()
    gmail_thread_id = str(message_json.get("threadId") or "").strip()
    if not gmail_message_id or not gmail_thread_id:
        return None
    internal_ms = int(message_json.get("internalDate") or "0")
    received_at = datetime.fromtimestamp(internal_ms / 1000, tz=UTC) if internal_ms else datetime.now(UTC)
    return InboundEmailMessage(
        gmail_message_id=gmail_message_id,
        gmail_thread_id=gmail_thread_id,
        internet_message_id=headers.get("message-id") or None,
        subject=headers.get("subject") or "(ingen emnelinje)",
        from_email=_parse_email_address(headers.get("from")),
        to_email=headers.get("to") or None,
        body_text=_payload_body_text(payload).strip(),
        received_at=received_at,
        in_reply_to=headers.get("in-reply-to") or None,
        references=headers.get("references") or None,
    )


async def _gmail_get_json(access_token: str, path: str, *, params: dict | None = None) -> dict:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            f"{GMAIL_API_BASE}{path}",
            params=params,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
    if response.status_code >= 400:
        detail = response.text[:400]
        raise GmailApiError(f"Gmail API GET {path} fejlede ({response.status_code}): {detail}")
    return response.json()


async def _gmail_post_json(access_token: str, path: str, *, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            f"{GMAIL_API_BASE}{path}",
            json=payload,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
    if response.status_code >= 400:
        detail = response.text[:400]
        raise GmailApiError(f"Gmail API POST {path} fejlede ({response.status_code}): {detail}")
    return response.json()


async def _gmail_history_ids(access_token: str, history_id: str) -> tuple[list[str], str | None]:
    try:
        data = await _gmail_get_json(
            access_token,
            "/users/me/history",
            params={
                "startHistoryId": history_id,
                "historyTypes": "messageAdded",
                "maxResults": MAX_SYNC_MESSAGES,
            },
        )
    except GmailApiError as exc:
        if "404" in str(exc):
            return [], None
        raise
    msg_ids: list[str] = []
    for item in data.get("history", []):
        for added in item.get("messagesAdded", []):
            msg_id = str((added.get("message") or {}).get("id") or "").strip()
            if msg_id:
                msg_ids.append(msg_id)
    newest_history_id = str(data.get("historyId") or "").strip() or None
    return list(dict.fromkeys(msg_ids)), newest_history_id


async def _gmail_unread_ids(access_token: str) -> tuple[list[str], str | None]:
    data = await _gmail_get_json(
        access_token,
        "/users/me/messages",
        params={"q": "is:unread", "maxResults": MAX_SYNC_MESSAGES},
    )
    ids = [str(item.get("id") or "").strip() for item in data.get("messages", [])]
    ids = [item for item in ids if item]
    profile = await _gmail_get_json(access_token, "/users/me/profile")
    newest_history_id = str(profile.get("historyId") or "").strip() or None
    return ids, newest_history_id


async def _mark_message_processed(access_token: str, gmail_message_id: str) -> None:
    try:
        await _gmail_post_json(
            access_token,
            f"/users/me/messages/{gmail_message_id}/modify",
            payload={"removeLabelIds": ["UNREAD"]},
        )
    except GmailApiError:
        # Non-critical for ingestion.
        return


async def _existing_ticket_for_thread(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    gmail_thread_id: str,
) -> uuid.UUID | None:
    result = await db.execute(
        select(TicketEmail.ticket_id).where(
            TicketEmail.organization_id == organization_id,
            TicketEmail.gmail_thread_id == gmail_thread_id,
        )
    )
    return result.scalar_one_or_none()


async def _resolve_reporter_user_id(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    sender_email: str | None,
    fallback_user_id: uuid.UUID,
) -> uuid.UUID:
    sender = (sender_email or "").strip().lower()
    if sender:
        result = await db.execute(
            select(User).where(
                User.email == sender,
                User.organization_id == organization_id,
                User.deleted_at.is_(None),
                User.is_active.is_(True),
            )
        )
        user = result.scalar_one_or_none()
        if user is not None:
            return user.id
    return fallback_user_id


async def _create_ticket_from_inbound(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    fallback_user_id: uuid.UUID,
    message: InboundEmailMessage,
) -> Ticket:
    routing = await apply_routing(
        db,
        ticket_type="incident",
        category_id=None,
        subcategory_id=None,
        priority="medium",
    )
    now = datetime.now(UTC)
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number=await generate_ticket_number(db, "incident"),
        ticket_type="incident",
        title=normalize_ticket_title_from_subject(message.subject),
        description=build_ticket_description_from_email(message),
        status="assigned" if routing.assigned_team_id else "new",
        priority=routing.priority,
        reporter_user_id=await _resolve_reporter_user_id(
            db,
            organization_id=organization_id,
            sender_email=message.from_email,
            fallback_user_id=fallback_user_id,
        ),
        organization_id=organization_id,
        assigned_team_id=routing.assigned_team_id,
        assigned_user_id=routing.assigned_user_id,
        category_id=None,
        subcategory_id=None,
        source="email",
        escalation_level=0,
        gdpr_consent=False,
        gdpr_consent_at=None,
        subject_cpr=None,
        is_major=False,
        is_security_ticket=False,
        parent_ticket_id=None,
        tags=[],
        emoji=None,
        routing_metadata={},
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    db.add(ticket)
    await apply_sla_to_ticket(db, ticket, priority=routing.priority, start_at=now)
    await db.flush()
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=fallback_user_id,
            event_type="ticket.created",
            payload={"ticket_number": ticket.ticket_number, "source": "email"},
            created_at=now,
        )
    )
    return ticket


def _to_comma_joined(value: str | None) -> str | None:
    if not value:
        return None
    parts = [item.strip() for item in value.split(",") if item.strip()]
    return ", ".join(parts) if parts else None


async def _store_ticket_email(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    ticket_id: uuid.UUID,
    message: InboundEmailMessage,
    direction: str,
) -> TicketEmail:
    row = TicketEmail(
        id=uuid.uuid4(),
        organization_id=organization_id,
        ticket_id=ticket_id,
        gmail_thread_id=message.gmail_thread_id,
        gmail_message_id=message.gmail_message_id,
        internet_message_id=message.internet_message_id,
        direction=direction,
        subject=message.subject,
        from_email=message.from_email,
        to_email=_to_comma_joined(message.to_email),
        body_text=message.body_text,
        received_at=message.received_at,
    )
    db.add(row)
    return row


async def sync_gmail_inbox(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    actor_user_id: uuid.UUID,
) -> GmailSyncStats:
    integration = await get_email_integration(db, organization_id=organization_id)
    stats = GmailSyncStats()

    if integration is None or not integration.refresh_token_encrypted:
        if settings.gmail_mock:
            from star_itsm_api.services.gmail_mock import mock_messages

            for mock in mock_messages():
                message = InboundEmailMessage(
                    gmail_message_id=mock["gmail_message_id"],
                    gmail_thread_id=mock["gmail_thread_id"],
                    internet_message_id=mock.get("internet_message_id"),
                    subject=mock.get("subject") or "(ingen emnelinje)",
                    from_email=mock.get("from_email"),
                    to_email=mock.get("to_email"),
                    body_text=mock.get("body_text") or "",
                    received_at=mock.get("received_at") or datetime.now(UTC),
                    in_reply_to=None,
                    references=None,
                )
                exists = await db.execute(
                    select(TicketEmail).where(TicketEmail.gmail_message_id == message.gmail_message_id)
                )
                if exists.scalar_one_or_none() is not None:
                    stats.skipped_duplicates += 1
                    continue
                ticket_id = await _existing_ticket_for_thread(
                    db,
                    organization_id=organization_id,
                    gmail_thread_id=message.gmail_thread_id,
                )
                if ticket_id is None:
                    ticket = await _create_ticket_from_inbound(
                        db,
                        organization_id=organization_id,
                        fallback_user_id=actor_user_id,
                        message=message,
                    )
                    ticket_id = ticket.id
                    stats.created_tickets += 1
                else:
                    stats.appended_to_threads += 1
                await _store_ticket_email(
                    db,
                    organization_id=organization_id,
                    ticket_id=ticket_id,
                    message=message,
                    direction="inbound",
                )
                db.add(
                    TicketEvent(
                        id=uuid.uuid4(),
                        ticket_id=ticket_id,
                        actor_user_id=actor_user_id,
                        event_type="email.received",
                        payload={"from": message.from_email, "subject": message.subject},
                        created_at=message.received_at,
                    )
                )
                stats.processed += 1
            await db.commit()
            return stats
        raise GmailApiError("Gmail er ikke forbundet.")

    access_token = await refresh_access_token(integration)
    if integration.last_history_id:
        message_ids, newest_history_id = await _gmail_history_ids(access_token, integration.last_history_id)
        if newest_history_id is None:
            message_ids, newest_history_id = await _gmail_unread_ids(access_token)
    else:
        message_ids, newest_history_id = await _gmail_unread_ids(access_token)

    for gmail_message_id in message_ids:
        existing = await db.execute(
            select(TicketEmail).where(TicketEmail.gmail_message_id == gmail_message_id)
        )
        if existing.scalar_one_or_none() is not None:
            stats.skipped_duplicates += 1
            continue
        raw = await _gmail_get_json(access_token, f"/users/me/messages/{gmail_message_id}", params={"format": "full"})
        message = parse_gmail_message(raw)
        if message is None:
            continue
        if integration.connected_email and _normalize_email(message.from_email) == _normalize_email(
            integration.connected_email
        ):
            continue
        if not _message_targets_sync_mailbox(message):
            continue
        ticket_id = await _existing_ticket_for_thread(
            db,
            organization_id=organization_id,
            gmail_thread_id=message.gmail_thread_id,
        )
        if ticket_id is None:
            ticket = await _create_ticket_from_inbound(
                db,
                organization_id=organization_id,
                fallback_user_id=actor_user_id,
                message=message,
            )
            ticket_id = ticket.id
            stats.created_tickets += 1
        else:
            stats.appended_to_threads += 1
        await _store_ticket_email(
            db,
            organization_id=organization_id,
            ticket_id=ticket_id,
            message=message,
            direction="inbound",
        )
        db.add(
            TicketEvent(
                id=uuid.uuid4(),
                ticket_id=ticket_id,
                actor_user_id=actor_user_id,
                event_type="email.received",
                payload={"from": message.from_email, "subject": message.subject},
                created_at=message.received_at,
            )
        )
        await _mark_message_processed(access_token, gmail_message_id)
        stats.processed += 1

    integration.last_history_id = newest_history_id or integration.last_history_id
    integration.last_sync_at = datetime.now(UTC)
    await db.commit()
    return stats


async def list_ticket_emails(
    db: AsyncSession,
    *,
    ticket_id: uuid.UUID,
) -> list[TicketEmail]:
    result = await db.execute(
        select(TicketEmail).where(TicketEmail.ticket_id == ticket_id).order_by(TicketEmail.received_at.asc())
    )
    return list(result.scalars().all())


def _latest_thread_email_stmt(ticket_id: uuid.UUID) -> Select[tuple[TicketEmail]]:
    return (
        select(TicketEmail)
        .where(TicketEmail.ticket_id == ticket_id)
        .order_by(TicketEmail.received_at.desc())
        .limit(1)
    )


async def send_ticket_email_reply(
    db: AsyncSession,
    *,
    ticket: Ticket,
    actor: User,
    body: str,
    to_email_override: str | None = None,
) -> TicketEmail:
    org_id = get_user_organization_id(actor)
    if org_id is None:
        raise GmailApiError("Bruger er ikke knyttet til en organisation.")
    integration = await get_email_integration(db, organization_id=org_id)

    if integration is None or not integration.refresh_token_encrypted:
        if not settings.gmail_mock:
            raise GmailApiError("Gmail er ikke forbundet.")
        now = datetime.now(UTC)
        latest = await db.execute(_latest_thread_email_stmt(ticket.id))
        latest_email = latest.scalar_one_or_none()
        thread_id = latest_email.gmail_thread_id if latest_email else f"mock-thread-{ticket.id}"
        subject = build_reply_subject(ticket.ticket_number, latest_email.subject if latest_email else ticket.title)
        outbound = InboundEmailMessage(
            gmail_message_id=f"mock-outbound-{uuid.uuid4()}",
            gmail_thread_id=thread_id,
            internet_message_id=None,
            subject=subject,
            from_email="mock-stardesk@example.dk",
            to_email=to_email_override or latest_email.from_email if latest_email else None,
            body_text=f"{body.strip()}\n\nSagsnummer: {ticket.ticket_number}",
            received_at=now,
            in_reply_to=latest_email.internet_message_id if latest_email else None,
            references=latest_email.internet_message_id if latest_email else None,
        )
        row = await _store_ticket_email(
            db,
            organization_id=org_id,
            ticket_id=ticket.id,
            message=outbound,
            direction="outbound",
        )
        db.add(
            TicketEvent(
                id=uuid.uuid4(),
                ticket_id=ticket.id,
                actor_user_id=actor.id,
                event_type="email.sent",
                payload={"to": outbound.to_email, "subject": outbound.subject, "mock": True},
                created_at=now,
            )
        )
        await db.commit()
        await db.refresh(row)
        return row

    access_token = await refresh_access_token(integration)
    latest_result = await db.execute(_latest_thread_email_stmt(ticket.id))
    latest_email = latest_result.scalar_one_or_none()
    if latest_email is None:
        raise GmailApiError("Sagen har ingen e-mail tråd endnu.")

    to_email = (to_email_override or latest_email.from_email or "").strip()
    if not to_email:
        raise GmailApiError("Kunne ikke finde modtager for e-mail svar.")

    subject = build_reply_subject(ticket.ticket_number, latest_email.subject or ticket.title)
    final_body = f"{body.strip()}\n\nSagsnummer: {ticket.ticket_number}".strip()
    msg = EmailMessage()
    msg["To"] = to_email
    msg["From"] = build_outbound_from_address(connected_email=integration.connected_email)
    msg["Subject"] = subject
    if latest_email.internet_message_id:
        msg["In-Reply-To"] = latest_email.internet_message_id
        msg["References"] = latest_email.internet_message_id
    msg.set_content(final_body)
    encoded = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

    response = await _gmail_post_json(
        access_token,
        "/users/me/messages/send",
        payload={
            "raw": encoded,
            "threadId": latest_email.gmail_thread_id,
        },
    )
    gmail_message_id = str(response.get("id") or "").strip()
    gmail_thread_id = str(response.get("threadId") or "").strip() or latest_email.gmail_thread_id
    if not gmail_message_id:
        raise GmailApiError("Gmail returnerede ikke message id ved send.")

    outbound = InboundEmailMessage(
        gmail_message_id=gmail_message_id,
        gmail_thread_id=gmail_thread_id,
        internet_message_id=None,
        subject=subject,
        from_email=integration.connected_email,
        to_email=to_email,
        body_text=final_body,
        received_at=datetime.now(UTC),
        in_reply_to=latest_email.internet_message_id,
        references=latest_email.internet_message_id,
    )
    row = await _store_ticket_email(
        db,
        organization_id=org_id,
        ticket_id=ticket.id,
        message=outbound,
        direction="outbound",
    )
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=actor.id,
            event_type="email.sent",
            payload={"to": to_email, "subject": subject},
            created_at=outbound.received_at,
        )
    )
    await db.commit()
    await db.refresh(row)
    return row
