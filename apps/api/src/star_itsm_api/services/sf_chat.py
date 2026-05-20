"""SF group live chat — presence, queue, sessions, messages."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.sf_chat_message import SfChatMessage
from star_itsm_api.models.sf_chat_presence import SfChatPresence
from star_itsm_api.models.sf_chat_session import (
    SESSION_ACTIVE,
    SESSION_CLOSED,
    SESSION_REJECTED_QUEUE,
    SESSION_WAITING,
    SfChatSession,
)
from star_itsm_api.models.team import Team
from star_itsm_api.models.team_member import TeamMember
from star_itsm_api.models.user import User
from star_itsm_api.schemas.sf_chat import (
    SfChatAgentInboxItem,
    SfChatAgentInboxRead,
    SfChatLogoutCheckRead,
    SfChatMessageRead,
    SfChatPresenceRead,
    SfChatSessionRead,
    SfChatStatusRead,
)

SF_TEAM_NAME = "SF"
PRESENCE_STALE_SECONDS = 90
MAX_WAITING_QUEUE = 8
TYPING_ABANDON_SECONDS = 45

MSG_CHAT_CLOSED = "Chatten er ikke åben lige nu. Prøv igen senere."
MSG_QUEUE_REJECTED = (
    "Der er meget lange køer lige nu, så chatten er utilgængelig. "
    "Prøv venligst igen senere."
)
MSG_CHAT_OPEN = "SF er klar til at chatte."


def _now() -> datetime:
    return datetime.now(UTC)


async def get_sf_team_id(db: AsyncSession) -> uuid.UUID | None:
    result = await db.execute(
        select(Team.id).where(Team.name == SF_TEAM_NAME, Team.is_active.is_(True)).limit(1)
    )
    return result.scalar_one_or_none()


async def is_sf_team_member(db: AsyncSession, user_id: uuid.UUID) -> bool:
    team_id = await get_sf_team_id(db)
    if team_id is None:
        return False
    result = await db.execute(
        select(TeamMember.team_id).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def _fresh_online_agent_ids(db: AsyncSession) -> list[uuid.UUID]:
    team_id = await get_sf_team_id(db)
    if team_id is None:
        return []
    cutoff = _now() - timedelta(seconds=PRESENCE_STALE_SECONDS)
    result = await db.execute(
        select(SfChatPresence.user_id)
        .join(TeamMember, TeamMember.user_id == SfChatPresence.user_id)
        .where(
            TeamMember.team_id == team_id,
            SfChatPresence.is_online.is_(True),
            SfChatPresence.last_seen_at >= cutoff,
        )
    )
    return list(result.scalars().all())


async def count_waiting_sessions(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(SfChatSession)
        .where(SfChatSession.status == SESSION_WAITING)
    )
    return int(result.scalar_one() or 0)


async def get_chat_status(db: AsyncSession) -> SfChatStatusRead:
    agents = await _fresh_online_agent_ids(db)
    open_ = len(agents) > 0
    return SfChatStatusRead(
        open=open_,
        available_agents=len(agents),
        message=MSG_CHAT_OPEN if open_ else MSG_CHAT_CLOSED,
    )


async def _user_display(db: AsyncSession, user_id: uuid.UUID) -> str:
    user = await db.get(User, user_id)
    if user is None:
        return "Ukendt"
    return user.display_name or user.email


def _session_read(
    session: SfChatSession,
    *,
    agent_name: str | None = None,
    queue_message: str | None = None,
) -> SfChatSessionRead:
    return SfChatSessionRead(
        id=session.id,
        status=session.status,
        assigned_agent_id=session.assigned_agent_id,
        assigned_agent_name=agent_name,
        created_at=session.created_at,
        updated_at=session.updated_at,
        queue_message=queue_message,
    )


async def _message_reads(
    db: AsyncSession,
    session_id: uuid.UUID,
    viewer_id: uuid.UUID,
) -> list[SfChatMessageRead]:
    result = await db.execute(
        select(SfChatMessage, User)
        .join(User, SfChatMessage.sender_user_id == User.id)
        .where(SfChatMessage.session_id == session_id)
        .order_by(SfChatMessage.created_at.asc())
    )
    return [
        SfChatMessageRead(
            id=msg.id,
            session_id=msg.session_id,
            sender_user_id=msg.sender_user_id,
            sender_display_name=user.display_name or user.email,
            body=msg.body,
            created_at=msg.created_at,
            is_own=msg.sender_user_id == viewer_id,
        )
        for msg, user in result.all()
    ]


async def get_or_create_customer_session(
    db: AsyncSession,
    customer: User,
) -> tuple[SfChatSession, list[SfChatMessageRead], SfChatStatusRead, str | None]:
    """Return session, messages, status, and optional error detail."""
    status = await get_chat_status(db)

    existing = await db.execute(
        select(SfChatSession)
        .where(
            SfChatSession.customer_user_id == customer.id,
            SfChatSession.status.in_((SESSION_WAITING, SESSION_ACTIVE)),
        )
        .order_by(SfChatSession.created_at.desc())
        .limit(1)
    )
    session = existing.scalar_one_or_none()

    if session is not None:
        agent_name = None
        if session.assigned_agent_id:
            agent_name = await _user_display(db, session.assigned_agent_id)
        queue_msg = MSG_QUEUE_REJECTED if session.status == SESSION_REJECTED_QUEUE else None
        messages = await _message_reads(db, session.id, customer.id)
        return session, messages, status, queue_msg

    if not status.open:
        return _reject_placeholder_session(customer.id), [], status, MSG_CHAT_CLOSED

    if await count_waiting_sessions(db) >= MAX_WAITING_QUEUE:
        rejected = await _create_rejected_session(db, customer.id)
        return rejected, [], status, MSG_QUEUE_REJECTED

    session = await _create_waiting_session(db, customer.id)
    await _try_assign_agent(db, session)
    await db.commit()
    await db.refresh(session)
    agent_name = None
    if session.assigned_agent_id:
        agent_name = await _user_display(db, session.assigned_agent_id)
    messages = await _message_reads(db, session.id, customer.id)
    return session, messages, status, None


def _reject_placeholder_session(customer_id: uuid.UUID) -> SfChatSession:
    now = _now()
    return SfChatSession(
        id=uuid.uuid4(),
        customer_user_id=customer_id,
        assigned_agent_id=None,
        status=SESSION_CLOSED,
        created_at=now,
        updated_at=now,
    )


async def _create_rejected_session(db: AsyncSession, customer_id: uuid.UUID) -> SfChatSession:
    now = _now()
    session = SfChatSession(
        customer_user_id=customer_id,
        status=SESSION_REJECTED_QUEUE,
        queue_rejected_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(session)
    await db.flush()
    return session


async def _create_waiting_session(db: AsyncSession, customer_id: uuid.UUID) -> SfChatSession:
    now = _now()
    session = SfChatSession(
        customer_user_id=customer_id,
        status=SESSION_WAITING,
        created_at=now,
        updated_at=now,
    )
    db.add(session)
    await db.flush()
    return session


async def _agent_active_session_count(db: AsyncSession, agent_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(SfChatSession)
        .where(
            SfChatSession.assigned_agent_id == agent_id,
            SfChatSession.status == SESSION_ACTIVE,
        )
    )
    return int(result.scalar_one() or 0)


async def _pick_agent(db: AsyncSession) -> uuid.UUID | None:
    online_ids = await _fresh_online_agent_ids(db)
    if not online_ids:
        return None
    best_id: uuid.UUID | None = None
    best_load = 10_000
    for agent_id in online_ids:
        load = await _agent_active_session_count(db, agent_id)
        if load < best_load:
            best_load = load
            best_id = agent_id
    if best_load >= 3:
        return None
    return best_id


async def _try_assign_agent(db: AsyncSession, session: SfChatSession) -> None:
    agent_id = await _pick_agent(db)
    if agent_id is None:
        return
    session.assigned_agent_id = agent_id
    session.status = SESSION_ACTIVE
    session.updated_at = _now()
    presence = await db.get(SfChatPresence, agent_id)
    if presence is None:
        now = _now()
        presence = SfChatPresence(
            user_id=agent_id,
            is_online=True,
            active_session_id=session.id,
            last_seen_at=now,
            updated_at=now,
        )
        db.add(presence)
    else:
        presence.active_session_id = session.id
        presence.updated_at = _now()


async def record_customer_typing(db: AsyncSession, session_id: uuid.UUID, customer_id: uuid.UUID) -> None:
    session = await db.get(SfChatSession, session_id)
    if session is None or session.customer_user_id != customer_id:
        return
    if session.status not in (SESSION_WAITING, SESSION_ACTIVE):
        return
    session.customer_last_typing_at = _now()
    session.updated_at = _now()
    await db.commit()


async def abandon_customer_session(
    db: AsyncSession,
    session_id: uuid.UUID,
    customer_id: uuid.UUID,
) -> SfChatSession | None:
    session = await db.get(SfChatSession, session_id)
    if session is None or session.customer_user_id != customer_id:
        return None
    if session.status not in (SESSION_WAITING, SESSION_ACTIVE):
        return session

    msg_count = await db.execute(
        select(func.count())
        .select_from(SfChatMessage)
        .where(SfChatMessage.session_id == session_id)
    )
    has_messages = int(msg_count.scalar_one() or 0) > 0
    typed = session.customer_last_typing_at is not None

    if typed and not has_messages:
        session.status = SESSION_REJECTED_QUEUE
        session.queue_rejected_at = _now()
    else:
        session.status = SESSION_CLOSED
    session.updated_at = _now()
    await db.commit()
    await db.refresh(session)
    return session


async def add_message(
    db: AsyncSession,
    session_id: uuid.UUID,
    sender: User,
    body: str,
) -> SfChatMessage:
    session = await db.get(SfChatSession, session_id)
    if session is None:
        raise ValueError("session_not_found")

    is_customer = session.customer_user_id == sender.id
    is_assigned_agent = session.assigned_agent_id == sender.id
    is_sf_agent = await is_sf_team_member(db, sender.id)

    if is_customer:
        if session.status == SESSION_REJECTED_QUEUE:
            raise ValueError("queue_rejected")
        if session.status == SESSION_CLOSED:
            raise ValueError("session_closed")
        if session.status == SESSION_WAITING:
            await _try_assign_agent(db, session)
            if session.status == SESSION_WAITING and not await _fresh_online_agent_ids(db):
                session.status = SESSION_REJECTED_QUEUE
                session.queue_rejected_at = _now()
                await db.commit()
                raise ValueError("chat_closed")
    elif not (is_assigned_agent or (is_sf_agent and session.status == SESSION_WAITING)):
        raise ValueError("forbidden")

    if session.status == SESSION_WAITING and is_sf_agent:
        session.assigned_agent_id = sender.id
        session.status = SESSION_ACTIVE
        presence = await db.get(SfChatPresence, sender.id)
        if presence:
            presence.active_session_id = session.id

    now = _now()
    msg = SfChatMessage(
        session_id=session_id,
        sender_user_id=sender.id,
        body=body.strip(),
        created_at=now,
    )
    db.add(msg)
    session.updated_at = now
    if session.status == SESSION_ACTIVE:
        session.status = SESSION_ACTIVE
    await db.commit()
    await db.refresh(msg)
    return msg


async def get_presence(db: AsyncSession, user: User) -> SfChatPresenceRead:
    sf_member = await is_sf_team_member(db, user.id)
    row = await db.get(SfChatPresence, user.id)
    if row is None:
        return SfChatPresenceRead(is_online=False, is_sf_member=sf_member)
    return SfChatPresenceRead(
        is_online=row.is_online,
        is_sf_member=sf_member,
        active_session_id=row.active_session_id,
        last_seen_at=row.last_seen_at,
    )


async def set_presence_online(db: AsyncSession, user: User, *, online: bool, force: bool) -> SfChatPresenceRead:
    if not await is_sf_team_member(db, user.id):
        raise ValueError("not_sf_member")

    if not online and not force:
        check = await logout_check(db, user)
        if not check.can_logout:
            raise ValueError("logout_blocked")

    now = _now()
    row = await db.get(SfChatPresence, user.id)
    if row is None:
        row = SfChatPresence(
            user_id=user.id,
            is_online=online,
            last_seen_at=now,
            updated_at=now,
        )
        db.add(row)
    else:
        row.is_online = online
        row.last_seen_at = now
        row.updated_at = now
        if not online:
            row.active_session_id = None
    await db.commit()
    await db.refresh(row)
    sf_member = True
    return SfChatPresenceRead(
        is_online=row.is_online,
        is_sf_member=sf_member,
        active_session_id=row.active_session_id,
        last_seen_at=row.last_seen_at,
    )


async def heartbeat_presence(db: AsyncSession, user: User) -> None:
    if not await is_sf_team_member(db, user.id):
        return
    now = _now()
    row = await db.get(SfChatPresence, user.id)
    if row is None or not row.is_online:
        return
    row.last_seen_at = now
    row.updated_at = now
    await db.commit()


async def logout_check(db: AsyncSession, user: User) -> SfChatLogoutCheckRead:
    if not await is_sf_team_member(db, user.id):
        return SfChatLogoutCheckRead(can_logout=True)

    presence = await db.get(SfChatPresence, user.id)
    if presence is None or not presence.is_online:
        return SfChatLogoutCheckRead(can_logout=True)

    active_result = await db.execute(
        select(func.count())
        .select_from(SfChatSession)
        .where(
            SfChatSession.assigned_agent_id == user.id,
            SfChatSession.status == SESSION_ACTIVE,
        )
    )
    active_count = int(active_result.scalar_one() or 0)

    waiting_result = await db.execute(
        select(func.count())
        .select_from(SfChatSession)
        .where(SfChatSession.status == SESSION_WAITING)
    )
    waiting_count = int(waiting_result.scalar_one() or 0)

    recent_typing_cutoff = _now() - timedelta(seconds=30)
    typing_result = await db.execute(
        select(func.count())
        .select_from(SfChatSession)
        .where(
            SfChatSession.status == SESSION_WAITING,
            SfChatSession.customer_last_typing_at.is_not(None),
            SfChatSession.customer_last_typing_at >= recent_typing_cutoff,
        )
    )
    typing_waiting = int(typing_result.scalar_one() or 0)

    if active_count > 0 or typing_waiting > 0 or (waiting_count > 0 and presence.is_online):
        reason_parts = []
        if active_count:
            reason_parts.append(f"{active_count} aktiv chat")
        if waiting_count:
            reason_parts.append(f"{waiting_count} venter i kø")
        if typing_waiting:
            reason_parts.append("kunder skriver lige nu")
        return SfChatLogoutCheckRead(
            can_logout=False,
            reason="Der er stadig aktivitet i SF-chat: " + ", ".join(reason_parts) + ".",
            waiting_sessions=waiting_count,
            active_sessions=active_count,
        )

    return SfChatLogoutCheckRead(can_logout=True)


async def build_agent_inbox(db: AsyncSession, agent: User) -> SfChatAgentInboxRead:
    if not await is_sf_team_member(db, agent.id):
        return SfChatAgentInboxRead(items=[], online=False, notification_count=0)

    presence = await db.get(SfChatPresence, agent.id)
    online = bool(presence and presence.is_online)

    stmt = (
        select(SfChatSession, User)
        .join(User, SfChatSession.customer_user_id == User.id)
        .where(
            SfChatSession.status.in_((SESSION_WAITING, SESSION_ACTIVE)),
            (SfChatSession.assigned_agent_id.is_(None))
            | (SfChatSession.assigned_agent_id == agent.id),
        )
        .order_by(SfChatSession.updated_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    items: list[SfChatAgentInboxItem] = []
    notification_count = 0
    recent_cutoff = _now() - timedelta(minutes=5)

    for session, customer in rows:
        last_msg_result = await db.execute(
            select(SfChatMessage)
            .where(SfChatMessage.session_id == session.id)
            .order_by(SfChatMessage.created_at.desc())
            .limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()
        unread = 0
        if last_msg and last_msg.sender_user_id == session.customer_user_id:
            if last_msg.created_at >= recent_cutoff:
                unread = 1
                notification_count += 1

        agent_name = None
        if session.assigned_agent_id:
            agent_name = await _user_display(db, session.assigned_agent_id)

        typing = False
        if session.customer_last_typing_at:
            typing = session.customer_last_typing_at >= _now() - timedelta(seconds=12)

        items.append(
            SfChatAgentInboxItem(
                session=_session_read(session, agent_name=agent_name),
                customer_display_name=customer.display_name or customer.email,
                customer_email=customer.email,
                last_message_preview=last_msg.body[:80] if last_msg else None,
                last_message_at=last_msg.created_at if last_msg else None,
                unread_count=unread,
                customer_is_typing=typing,
            )
        )

    return SfChatAgentInboxRead(
        items=items,
        online=online,
        notification_count=notification_count,
    )


async def session_for_user(
    db: AsyncSession,
    session_id: uuid.UUID,
    user: User,
) -> SfChatSession | None:
    session = await db.get(SfChatSession, session_id)
    if session is None:
        return None
    if session.customer_user_id == user.id:
        return session
    if await is_sf_team_member(db, user.id):
        if session.assigned_agent_id in (None, user.id) or session.status == SESSION_WAITING:
            return session
    return None
