import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.config import settings
from star_itsm_api.core.security import require_admin, require_staff
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.gmail import (
    GmailOAuthCallbackResponse,
    GmailOAuthStartResponse,
    GmailSettingsUpdate,
    GmailStatusRead,
    GmailSyncResponse,
    GmailTestResponse,
)
from star_itsm_api.services.gmail import (
    GmailApiError,
    build_oauth_authorize_url,
    create_oauth_state,
    disconnect_gmail,
    exchange_oauth_code,
    fetch_profile_email,
    get_email_integration,
    parse_oauth_state,
    refresh_access_token,
    save_gmail_preferences,
    sync_gmail_inbox,
    upsert_email_integration,
)
from star_itsm_api.services.gmail_mock import MOCK_GMAIL_EMAIL
from star_itsm_api.services.org_access import get_user_organization_id

router = APIRouter(prefix="/integrations/gmail", tags=["gmail"])


def _require_org_id(user: User) -> uuid.UUID:
    org_id = get_user_organization_id(user)
    if org_id is None:
        raise HTTPException(status_code=400, detail="Bruger er ikke knyttet til en organisation.")
    return org_id


@router.get("/oauth/start", response_model=GmailOAuthStartResponse)
async def start_gmail_oauth(current_user: User = Depends(require_admin())) -> GmailOAuthStartResponse:
    org_id = _require_org_id(current_user)
    try:
        state = create_oauth_state(org_id=org_id, user_id=current_user.id)
        authorize_url = build_oauth_authorize_url(state=state)
    except GmailApiError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return GmailOAuthStartResponse(authorize_url=authorize_url)


@router.get("/oauth/callback", response_model=GmailOAuthCallbackResponse)
async def gmail_oauth_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: AsyncSession = Depends(require_db),
) -> GmailOAuthCallbackResponse:
    if error:
        raise HTTPException(status_code=400, detail=f"Gmail OAuth fejl: {error}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Mangler Gmail OAuth kode eller state.")
    try:
        org_id, _user_id = parse_oauth_state(state)
        existing = await get_email_integration(db, organization_id=org_id)
        access_token, refresh_token = await exchange_oauth_code(code)
        connected_email = await fetch_profile_email(access_token)
        await upsert_email_integration(
            db,
            organization_id=org_id,
            connected_email=connected_email,
            refresh_token=refresh_token,
            existing_refresh_token_encrypted=existing.refresh_token_encrypted if existing else None,
        )
    except GmailApiError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return GmailOAuthCallbackResponse(connected=True, connected_email=connected_email)


@router.get("/status", response_model=GmailStatusRead)
async def gmail_status(
    current_user: User = Depends(require_staff()),
    db: AsyncSession = Depends(require_db),
) -> GmailStatusRead:
    org_id = _require_org_id(current_user)
    integration = await get_email_integration(db, organization_id=org_id)
    if integration is None or not integration.refresh_token_encrypted:
        return GmailStatusRead(
            connected=False,
            enabled=False,
            connected_email=MOCK_GMAIL_EMAIL if settings.gmail_mock else None,
            mode="mock" if settings.gmail_mock else "real",
        )
    return GmailStatusRead(
        connected=True,
        enabled=integration.enabled,
        connected_email=integration.connected_email,
        last_history_id=integration.last_history_id,
        last_sync_at=integration.last_sync_at,
        mode="real",
    )


@router.patch("/settings", response_model=GmailStatusRead)
async def update_gmail_settings(
    payload: GmailSettingsUpdate,
    current_user: User = Depends(require_admin()),
    db: AsyncSession = Depends(require_db),
) -> GmailStatusRead:
    org_id = _require_org_id(current_user)
    integration = await save_gmail_preferences(
        db,
        organization_id=org_id,
        enabled=payload.enabled,
    )
    connected = bool(integration.refresh_token_encrypted)
    return GmailStatusRead(
        connected=connected,
        enabled=integration.enabled if connected else False,
        connected_email=integration.connected_email,
        last_history_id=integration.last_history_id,
        last_sync_at=integration.last_sync_at,
        mode="real" if connected else ("mock" if settings.gmail_mock else "real"),
    )


@router.post("/sync", response_model=GmailSyncResponse)
async def gmail_sync(
    current_user: User = Depends(require_admin()),
    db: AsyncSession = Depends(require_db),
) -> GmailSyncResponse:
    org_id = _require_org_id(current_user)
    try:
        stats = await sync_gmail_inbox(
            db,
            organization_id=org_id,
            actor_user_id=current_user.id,
        )
    except GmailApiError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return GmailSyncResponse(
        processed=stats.processed,
        created_tickets=stats.created_tickets,
        appended_to_threads=stats.appended_to_threads,
        skipped_duplicates=stats.skipped_duplicates,
        mode="mock" if settings.gmail_mock else "real",
    )


@router.get("/test", response_model=GmailTestResponse)
async def gmail_test_connection(
    current_user: User = Depends(require_admin()),
    db: AsyncSession = Depends(require_db),
) -> GmailTestResponse:
    org_id = _require_org_id(current_user)
    integration = await get_email_integration(db, organization_id=org_id)
    if integration is None or not integration.refresh_token_encrypted:
        if settings.gmail_mock:
            return GmailTestResponse(ok=True, connected_email=MOCK_GMAIL_EMAIL, detail="Mock mode aktiv")
        raise HTTPException(status_code=400, detail="Gmail er ikke forbundet.")
    try:
        access_token = await refresh_access_token(integration)
        connected_email = await fetch_profile_email(access_token)
    except GmailApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return GmailTestResponse(ok=True, connected_email=connected_email, detail="Forbindelse OK")


@router.post("/disconnect", response_model=GmailStatusRead)
async def disconnect_gmail_integration(
    current_user: User = Depends(require_admin()),
    db: AsyncSession = Depends(require_db),
) -> GmailStatusRead:
    org_id = _require_org_id(current_user)
    await disconnect_gmail(db, organization_id=org_id)
    return GmailStatusRead(
        connected=False,
        enabled=False,
        connected_email=MOCK_GMAIL_EMAIL if settings.gmail_mock else None,
        mode="mock" if settings.gmail_mock else "real",
    )
