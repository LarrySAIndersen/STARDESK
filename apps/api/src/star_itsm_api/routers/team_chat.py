import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status

from star_itsm_api.core.security import require_staff
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.team_chat import (
    TeamChatChannelCreate,
    TeamChatChannelRead,
    TeamChatDmCreate,
    TeamChatMessageCreate,
    TeamChatMessageRead,
    TeamChatMessagesRead,
    TeamChatPollRead,
    TeamChatReactionRead,
    TeamChatReactionToggle,
    TeamChatStaffRead,
)
from star_itsm_api.services import team_chat as chat_svc
from star_itsm_api.services.org_access import IntegrationOrganizationError
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/team-chat", tags=["team-chat"])


def _org_error(exc: IntegrationOrganizationError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.get("/channels", response_model=list[TeamChatChannelRead])
async def list_channels(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> list[TeamChatChannelRead]:
    try:
        return await chat_svc.list_channels(db, current_user)
    except IntegrationOrganizationError as exc:
        raise _org_error(exc) from exc


@router.post("/channels", response_model=TeamChatChannelRead, status_code=201)
async def create_channel(
    body: TeamChatChannelCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TeamChatChannelRead:
    try:
        return await chat_svc.create_channel(db, current_user, body)
    except IntegrationOrganizationError as exc:
        raise _org_error(exc) from exc


@router.get("/channels/{channel_id}/messages", response_model=TeamChatMessagesRead)
async def get_channel_messages(
    channel_id: uuid.UUID,
    after: datetime | None = Query(default=None),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TeamChatMessagesRead:
    try:
        messages = await chat_svc.list_messages(db, channel_id, current_user, after=after)
    except IntegrationOrganizationError as exc:
        raise _org_error(exc) from exc
    if not messages:
        channel = await chat_svc.get_channel_for_user(db, channel_id, current_user)
        if channel is None:
            raise HTTPException(status_code=404, detail="Kanal ikke fundet")
    return TeamChatMessagesRead(messages=messages)


@router.get("/channels/{channel_id}/poll", response_model=TeamChatPollRead)
async def poll_channel_messages(
    channel_id: uuid.UUID,
    after: datetime | None = Query(default=None),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TeamChatPollRead:
    try:
        messages = await chat_svc.list_messages(db, channel_id, current_user, after=after)
    except IntegrationOrganizationError as exc:
        raise _org_error(exc) from exc
    return TeamChatPollRead(messages=messages)


@router.post("/channels/{channel_id}/messages", response_model=TeamChatMessagesRead, status_code=201)
async def post_channel_message(
    channel_id: uuid.UUID,
    body: TeamChatMessageCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TeamChatMessagesRead:
    try:
        messages = await chat_svc.post_message(db, channel_id, current_user, body.body)
    except IntegrationOrganizationError as exc:
        raise _org_error(exc) from exc
    except ValueError as exc:
        if str(exc) == "channel_not_found":
            raise HTTPException(status_code=404, detail="Kanal ikke fundet") from exc
        raise HTTPException(status_code=400, detail="Besked må ikke være tom") from exc
    return TeamChatMessagesRead(messages=messages)


@router.post("/messages/{message_id}/reactions", response_model=list[TeamChatReactionRead])
async def toggle_message_reaction(
    message_id: uuid.UUID,
    body: TeamChatReactionToggle,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> list[TeamChatReactionRead]:
    try:
        return await chat_svc.toggle_reaction(db, message_id, current_user, body.emoji.strip())
    except IntegrationOrganizationError as exc:
        raise _org_error(exc) from exc
    except ValueError as exc:
        code = str(exc)
        if code == "message_not_found":
            raise HTTPException(status_code=404, detail="Besked ikke fundet") from exc
        if code == "channel_not_found":
            raise HTTPException(status_code=403, detail="Ingen adgang") from exc
        raise HTTPException(status_code=400, detail="Ugyldig reaktion") from exc


@router.get("/staff", response_model=list[TeamChatStaffRead])
async def list_staff(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> list[TeamChatStaffRead]:
    try:
        return await chat_svc.list_staff(db, current_user)
    except IntegrationOrganizationError as exc:
        raise _org_error(exc) from exc


@router.post("/dm", response_model=TeamChatChannelRead, status_code=201)
async def create_dm(
    body: TeamChatDmCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TeamChatChannelRead:
    try:
        return await chat_svc.get_or_create_dm(db, current_user, body.user_id)
    except IntegrationOrganizationError as exc:
        raise _org_error(exc) from exc
    except ValueError as exc:
        code = str(exc)
        if code == "user_not_found":
            raise HTTPException(status_code=404, detail="Bruger ikke fundet") from exc
        if code == "self_dm":
            raise HTTPException(status_code=400, detail="Du kan ikke DM'e dig selv") from exc
        raise HTTPException(status_code=400, detail="Kunne ikke oprette DM") from exc
