from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import httpx
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.config import settings
from star_itsm_api.models.organization_integration import OrganizationIntegration

SLACK_PROVIDER = "slack"
SLACK_API_BASE = "https://slack.com/api"
SLACK_OAUTH_AUTHORIZE = "https://slack.com/oauth/v2/authorize"
SLACK_BOT_SCOPES = ("chat:write", "channels:read", "groups:read")


class SlackApiError(RuntimeError):
    pass


@dataclass(slots=True)
class SlackWorkspaceConnection:
    team_id: str
    team_name: str
    bot_token: str


@dataclass(slots=True)
class SlackPostedMessage:
    channel_id: str
    ts: str | None


@dataclass(slots=True)
class SlackChannel:
    channel_id: str
    name: str
    display_name_da: str
    is_private: bool


def _require_oauth_settings() -> tuple[str, str, str]:
    client_id = (settings.slack_client_id or "").strip()
    client_secret = (settings.slack_client_secret or "").strip()
    redirect_uri = (settings.slack_redirect_uri or "").strip()
    if not client_id or not client_secret or not redirect_uri:
        raise SlackApiError("Slack OAuth mangler konfiguration i miljøvariabler.")
    return client_id, client_secret, redirect_uri


def create_oauth_state(*, org_id: uuid.UUID, user_id: uuid.UUID) -> str:
    if not settings.jwt_secret:
        raise SlackApiError("JWT_SECRET mangler; kan ikke starte Slack OAuth.")
    payload = {
        "org_id": str(org_id),
        "user_id": str(user_id),
        "purpose": "slack_oauth",
        "exp": datetime.now(UTC) + timedelta(minutes=10),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def parse_oauth_state(state: str) -> tuple[uuid.UUID, uuid.UUID]:
    if not settings.jwt_secret:
        raise SlackApiError("JWT_SECRET mangler; kan ikke validere Slack OAuth state.")
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("purpose") != "slack_oauth":
            raise SlackApiError("Ugyldig Slack OAuth state.")
        org_id = uuid.UUID(str(payload["org_id"]))
        user_id = uuid.UUID(str(payload["user_id"]))
        return org_id, user_id
    except (KeyError, ValueError, jwt.PyJWTError) as exc:
        raise SlackApiError("Ugyldig eller udløbet Slack OAuth state.") from exc


def build_oauth_authorize_url(*, state: str) -> str:
    client_id, _client_secret, redirect_uri = _require_oauth_settings()
    query = urlencode(
        {
            "client_id": client_id,
            "scope": ",".join(SLACK_BOT_SCOPES),
            "redirect_uri": redirect_uri,
            "state": state,
        }
    )
    return f"{SLACK_OAUTH_AUTHORIZE}?{query}"


async def exchange_oauth_code(code: str) -> SlackWorkspaceConnection:
    client_id, client_secret, redirect_uri = _require_oauth_settings()
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            f"{SLACK_API_BASE}/oauth.v2.access",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
    if response.status_code >= 400:
        raise SlackApiError("Slack OAuth token exchange fejlede.")
    data = response.json()
    if not data.get("ok"):
        raise SlackApiError(data.get("error") or "Slack OAuth blev afvist.")
    token = str(data.get("access_token") or "").strip()
    team = data.get("team") or {}
    team_id = str(team.get("id") or "").strip()
    team_name = str(team.get("name") or "").strip()
    if not token or not team_id:
        raise SlackApiError("Slack OAuth svar manglede bot-token eller team-id.")
    return SlackWorkspaceConnection(
        team_id=team_id, team_name=team_name or team_id, bot_token=token
    )


async def get_slack_integration(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
) -> OrganizationIntegration | None:
    result = await db.execute(
        select(OrganizationIntegration).where(
            OrganizationIntegration.organization_id == organization_id,
            OrganizationIntegration.provider == SLACK_PROVIDER,
        )
    )
    return result.scalar_one_or_none()


async def upsert_slack_integration(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    team_id: str,
    team_name: str,
    bot_token: str,
) -> OrganizationIntegration:
    integration = await get_slack_integration(db, organization_id=organization_id)
    if integration is None:
        integration = OrganizationIntegration(
            organization_id=organization_id,
            provider=SLACK_PROVIDER,
        )
        db.add(integration)
    integration.slack_team_id = team_id
    integration.slack_team_name = team_name
    integration.slack_bot_token = bot_token
    integration.enabled = True
    await db.commit()
    await db.refresh(integration)
    return integration


async def save_slack_preferences(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    enabled: bool | None,
    default_channel_id: str | None,
    webhook_url: str | None,
) -> OrganizationIntegration:
    integration = await get_slack_integration(db, organization_id=organization_id)
    if integration is None:
        integration = OrganizationIntegration(
            organization_id=organization_id,
            provider=SLACK_PROVIDER,
            enabled=False,
        )
        db.add(integration)
    if enabled is not None:
        integration.enabled = enabled
    if default_channel_id is not None:
        integration.default_channel_id = default_channel_id or None
    if webhook_url is not None:
        integration.webhook_url = webhook_url or None
    await db.commit()
    await db.refresh(integration)
    return integration


async def disconnect_slack(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
) -> None:
    integration = await get_slack_integration(db, organization_id=organization_id)
    if integration is None:
        return
    integration.enabled = False
    integration.slack_bot_token = None
    integration.slack_team_id = None
    integration.slack_team_name = None
    integration.default_channel_id = None
    await db.commit()


def _auth_headers(bot_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {bot_token}",
        "Content-Type": "application/json; charset=utf-8",
    }


async def fetch_channels(bot_token: str) -> list[SlackChannel]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            f"{SLACK_API_BASE}/conversations.list",
            params={
                "exclude_archived": "true",
                "types": "public_channel,private_channel",
                "limit": 200,
            },
            headers=_auth_headers(bot_token),
        )
    if response.status_code >= 400:
        raise SlackApiError("Kunne ikke hente Slack-kanaler.")
    data = response.json()
    if not data.get("ok"):
        raise SlackApiError(data.get("error") or "Slack returnerede fejl ved kanalliste.")
    channels: list[SlackChannel] = []
    for channel in data.get("channels", []):
        channel_id = str(channel.get("id") or "").strip()
        name = str(channel.get("name") or "").strip()
        if not channel_id or not name:
            continue
        is_private = bool(channel.get("is_private", False))
        channels.append(
            SlackChannel(
                channel_id=channel_id,
                name=name,
                display_name_da=name.replace("-", " ").capitalize(),
                is_private=is_private,
            )
        )
    channels.sort(key=lambda item: item.name.lower())
    return channels


async def post_ticket_message(
    *,
    bot_token: str,
    channel_id: str,
    text: str,
) -> SlackPostedMessage:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            f"{SLACK_API_BASE}/chat.postMessage",
            headers=_auth_headers(bot_token),
            json={
                "channel": channel_id,
                "text": text,
                "unfurl_links": False,
                "unfurl_media": False,
            },
        )
    if response.status_code >= 400:
        raise SlackApiError("Slack afviste beskeden.")
    data = response.json()
    if not data.get("ok"):
        raise SlackApiError(data.get("error") or "Slack besked fejlede.")
    return SlackPostedMessage(
        channel_id=str(data.get("channel") or channel_id),
        ts=str(data.get("ts") or "") or None,
    )
