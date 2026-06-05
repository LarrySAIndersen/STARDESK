import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.http_details import CHAT_NOT_FOUND
from star_itsm_api.core.security import get_current_user, require_staff
from star_itsm_api.deps import require_db
from star_itsm_api.models.sf_chat_session import SESSION_CLOSED, SESSION_REJECTED_QUEUE
from star_itsm_api.models.user import User
from star_itsm_api.schemas.sf_chat import (
    SfChatAgentInboxRead,
    SfChatCreateTicketBody,
    SfChatLogoutCheckRead,
    SfChatMessageCreate,
    SfChatMessageRead,
    SfChatPollRead,
    SfChatPresenceRead,
    SfChatPresenceUpdate,
    SfChatSessionCreateResponse,
    SfChatSessionRead,
    SfChatStatusRead,
)
from star_itsm_api.schemas.ticket import TicketRead
from star_itsm_api.services import sf_chat as chat_svc
from star_itsm_api.services.ticket_read import ticket_to_read

router = APIRouter(prefix="/sf-chat", tags=["sf-chat"])


@router.get("/status")
async def chat_status(
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(get_current_user),
) -> SfChatStatusRead:
    return await chat_svc.get_chat_status(db)


@router.post("/sessions")
async def start_session(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> SfChatSessionCreateResponse:
    session, messages, chat_status, queue_msg = await chat_svc.get_or_create_customer_session(
        db, current_user
    )
    agent_name = None
    if session.assigned_agent_id:
        agent_name = await chat_svc._user_display(db, session.assigned_agent_id)

    if session.status == SESSION_CLOSED and not chat_status.open:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=chat_svc.MSG_CHAT_CLOSED,
        )

    queue_message = queue_msg
    if session.status == SESSION_REJECTED_QUEUE:
        queue_message = chat_svc.MSG_QUEUE_REJECTED

    return SfChatSessionCreateResponse(
        session=chat_svc._session_read(
            session,
            agent_name=agent_name,
            queue_message=queue_message,
        ),
        messages=messages,
    )


@router.get("/sessions/{session_id}/poll")
async def poll_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> SfChatPollRead:
    status = await chat_svc.get_chat_status(db)
    session = await chat_svc.session_for_user(db, session_id, current_user)
    if session is None:
        raise HTTPException(status_code=404, detail=CHAT_NOT_FOUND)

    agent_name = None
    if session.assigned_agent_id:
        agent_name = await chat_svc._user_display(db, session.assigned_agent_id)
    queue_message = (
        chat_svc.MSG_QUEUE_REJECTED if session.status == SESSION_REJECTED_QUEUE else None
    )
    messages = await chat_svc._message_reads(db, session.id, current_user.id)
    return SfChatPollRead(
        session=chat_svc._session_read(
            session,
            agent_name=agent_name,
            queue_message=queue_message,
        ),
        messages=messages,
        status=status,
    )


@router.post("/sessions/{session_id}/messages", status_code=201)
async def post_message(
    session_id: uuid.UUID,
    payload: SfChatMessageCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> SfChatMessageRead:
    session = await chat_svc.session_for_user(db, session_id, current_user)
    if session is None:
        raise HTTPException(status_code=404, detail=CHAT_NOT_FOUND)
    try:
        msg = await chat_svc.add_message(db, session_id, current_user, payload.body)
    except ValueError as exc:
        code = str(exc)
        if code == "queue_rejected":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=chat_svc.MSG_QUEUE_REJECTED,
            ) from exc
        if code == "chat_closed":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=chat_svc.MSG_CHAT_CLOSED,
            ) from exc
        if code == "forbidden":
            raise HTTPException(status_code=403, detail="Ingen adgang til denne chat") from exc
        raise HTTPException(status_code=400, detail="Kunne ikke sende besked") from exc

    name = await chat_svc._user_display(db, msg.sender_user_id) if msg.sender_user_id else "System"
    return SfChatMessageRead(
        id=msg.id,
        session_id=msg.session_id,
        sender_user_id=msg.sender_user_id,
        sender_display_name=name,
        body=msg.body,
        created_at=msg.created_at,
        is_own=True,
        is_system=msg.is_system,
    )


@router.post("/sessions/{session_id}/typing", status_code=204)
async def customer_typing(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> None:
    await chat_svc.record_customer_typing(db, session_id, current_user.id)


@router.post("/sessions/{session_id}/abandon")
async def abandon_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> SfChatSessionRead:
    session = await chat_svc.abandon_customer_session(db, session_id, current_user.id)
    if session is None:
        raise HTTPException(status_code=404, detail=CHAT_NOT_FOUND)
    queue_message = (
        chat_svc.MSG_QUEUE_REJECTED if session.status == SESSION_REJECTED_QUEUE else None
    )
    return chat_svc._session_read(session, queue_message=queue_message)


@router.post("/sessions/{session_id}/create-ticket", status_code=201)
async def create_ticket_from_sf_chat(
    session_id: uuid.UUID,
    payload: SfChatCreateTicketBody,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketRead:
    session = await chat_svc.session_for_user(db, session_id, current_user)
    if session is None:
        raise HTTPException(status_code=404, detail=CHAT_NOT_FOUND)
    try:
        ticket = await chat_svc.create_ticket_from_sf_chat_session(
            db,
            session_id=session_id,
            agent=current_user,
            title=payload.title,
        )
    except ValueError as exc:
        code = str(exc)
        if code == "not_sf_member":
            raise HTTPException(
                status_code=403, detail="Kun SF-gruppen kan oprette sager fra chat"
            ) from exc
        if code == "session_not_closed":
            raise HTTPException(
                status_code=409,
                detail="Chatten skal være afsluttet før den kan overføres til en sag.",
            ) from exc
        if code == "not_assigned_agent":
            raise HTTPException(
                status_code=403,
                detail="Kun den tildelte agent kan oprette en sag fra denne chat.",
            ) from exc
        if code == "title_too_short":
            raise HTTPException(status_code=400, detail="Titlen er for kort.") from exc
        raise HTTPException(status_code=400, detail="Kunne ikke oprette sag fra chat") from exc
    return await ticket_to_read(db, ticket)


@router.get("/presence")
async def get_presence(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> SfChatPresenceRead:
    return await chat_svc.get_presence(db, current_user)


@router.put("/presence")
async def update_presence(
    payload: SfChatPresenceUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> SfChatPresenceRead:
    try:
        return await chat_svc.set_presence_online(
            db, current_user, online=payload.online, force=payload.force
        )
    except ValueError as exc:
        code = str(exc)
        if code == "not_sf_member":
            raise HTTPException(
                status_code=403,
                detail="Kun medlemmer af SF-gruppen kan logge på chat.",
            ) from exc
        if code == "logout_blocked":
            check = await chat_svc.logout_check(db, current_user)
            raise HTTPException(
                status_code=409,
                detail=check.reason or "Du har aktiv SF-chat.",
            ) from exc
        raise HTTPException(status_code=400, detail="Kunne ikke opdatere tilstedeværelse") from exc


@router.post("/presence/heartbeat", status_code=204)
async def presence_heartbeat(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> None:
    await chat_svc.heartbeat_presence(db, current_user)


@router.get("/presence/logout-check")
async def presence_logout_check(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> SfChatLogoutCheckRead:
    return await chat_svc.logout_check(db, current_user)


@router.get("/agent/inbox")
async def agent_inbox(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> SfChatAgentInboxRead:
    return await chat_svc.build_agent_inbox(db, current_user)


@router.post("/sessions/{session_id}/start-bot")
async def start_bot_assistant(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> SfChatSessionRead:
    try:
        return await chat_svc.start_bot_assistant_for_session(
            db,
            session_id=session_id,
            agent=current_user,
        )
    except ValueError as exc:
        code = str(exc)
        if code == "not_sf_member":
            raise HTTPException(
                status_code=403, detail="Kun SF-agenter kan starte chat-service bot"
            ) from exc
        if code == "session_not_found":
            raise HTTPException(status_code=404, detail=CHAT_NOT_FOUND) from exc
        if code == "not_waiting":
            raise HTTPException(
                status_code=409,
                detail="Sag-assistenten kan kun startes for chats der venter i kø",
            ) from exc
        raise HTTPException(status_code=400, detail=code) from exc
