from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import require_admin, require_staff
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.slack import (
    SlackChannelRead,
    SlackOAuthCallbackResponse,
    SlackOAuthStartResponse,
    SlackSettingsUpdate,
    SlackStatusRead,
)
from star_itsm_api.routers.integration_org import require_integration_org_id
from star_itsm_api.services.slack import (
    SlackApiError,
    build_oauth_authorize_url,
    create_oauth_state,
    disconnect_slack,
    exchange_oauth_code,
    fetch_channels,
    get_slack_integration,
    parse_oauth_state,
    save_slack_preferences,
    upsert_slack_integration,
)
from star_itsm_api.services.slack_mock import MOCK_SLACK_CHANNELS
from star_itsm_api.core.config import settings

router = APIRouter(prefix="/integrations/slack", tags=["slack"])


@router.get("/oauth/start")
async def start_slack_oauth(
    current_user: User = Depends(require_admin()),
    db: AsyncSession = Depends(require_db),
) -> SlackOAuthStartResponse:
    org_id = await require_integration_org_id(db, current_user)
    try:
        state = create_oauth_state(org_id=org_id, user_id=current_user.id)
        authorize_url = build_oauth_authorize_url(state=state)
    except SlackApiError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return SlackOAuthStartResponse(authorize_url=authorize_url)


@router.get("/oauth/callback")
async def slack_oauth_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: AsyncSession = Depends(require_db),
) -> SlackOAuthCallbackResponse:
    if error:
        raise HTTPException(status_code=400, detail=f"Slack OAuth fejl: {error}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Mangler Slack OAuth kode eller state.")
    try:
        org_id, _user_id = parse_oauth_state(state)
        connection = await exchange_oauth_code(code)
        await upsert_slack_integration(
            db,
            organization_id=org_id,
            team_id=connection.team_id,
            team_name=connection.team_name,
            bot_token=connection.bot_token,
        )
    except SlackApiError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return SlackOAuthCallbackResponse(
        connected=True,
        team_id=connection.team_id,
        team_name=connection.team_name,
    )


@router.get("/status")
async def slack_status(
    current_user: User = Depends(require_staff()),
    db: AsyncSession = Depends(require_db),
) -> SlackStatusRead:
    org_id = await require_integration_org_id(db, current_user)
    integration = await get_slack_integration(db, organization_id=org_id)
    if integration is None or not integration.slack_bot_token:
        return SlackStatusRead(
            connected=False,
            enabled=False,
            mode="mock" if settings.slack_mock else "real",
        )
    return SlackStatusRead(
        connected=True,
        enabled=integration.enabled,
        team_id=integration.slack_team_id,
        team_name=integration.slack_team_name,
        default_channel_id=integration.default_channel_id,
        webhook_url=integration.webhook_url,
        mode="real",
    )


@router.patch("/settings")
async def update_slack_settings(
    payload: SlackSettingsUpdate,
    current_user: User = Depends(require_admin()),
    db: AsyncSession = Depends(require_db),
) -> SlackStatusRead:
    org_id = await require_integration_org_id(db, current_user)
    integration = await save_slack_preferences(
        db,
        organization_id=org_id,
        enabled=payload.enabled,
        default_channel_id=payload.default_channel_id,
        webhook_url=payload.webhook_url,
    )
    connected = bool(integration.slack_bot_token)
    return SlackStatusRead(
        connected=connected,
        enabled=integration.enabled if connected else False,
        team_id=integration.slack_team_id,
        team_name=integration.slack_team_name,
        default_channel_id=integration.default_channel_id,
        webhook_url=integration.webhook_url,
        mode="real" if connected else ("mock" if settings.slack_mock else "real"),
    )


@router.post("/disconnect")
async def disconnect_slack_integration(
    current_user: User = Depends(require_admin()),
    db: AsyncSession = Depends(require_db),
) -> SlackStatusRead:
    org_id = await require_integration_org_id(db, current_user)
    await disconnect_slack(db, organization_id=org_id)
    return SlackStatusRead(
        connected=False,
        enabled=False,
        mode="mock" if settings.slack_mock else "real",
    )


@router.get("/channels")
async def list_slack_channels(
    current_user: User = Depends(require_staff()),
    db: AsyncSession = Depends(require_db),
) -> list[SlackChannelRead]:
    org_id = await require_integration_org_id(db, current_user)
    integration = await get_slack_integration(db, organization_id=org_id)
    if integration is None or not integration.slack_bot_token:
        if settings.slack_mock:
            return [SlackChannelRead.model_validate(channel) for channel in MOCK_SLACK_CHANNELS]
        raise HTTPException(status_code=400, detail="Slack er ikke forbundet.")
    try:
        channels = await fetch_channels(integration.slack_bot_token)
    except SlackApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return [SlackChannelRead.model_validate(channel) for channel in channels]
