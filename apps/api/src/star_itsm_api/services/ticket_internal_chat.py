"""Internal ticket-linked chat — staff-only invites, mentions, personal overview."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import is_staff
from star_itsm_api.models.team_chat import (
    CHANNEL_TICKET,
    TeamChatChannel,
    TeamChatChannelMember,
    TeamChatMessage,
)
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_stakeholder import TicketStakeholder
from star_itsm_api.models.user import User
from star_itsm_api.schemas.ticket_internal_chat import (
    PersonalMentionItemRead,
    PersonalMentionsOverviewRead,
    TicketInternalChatRead,
)
from star_itsm_api.services.org_access import resolve_integration_organization_id
from star_itsm_api.services.team_chat import _message_reads, _user_display, post_message
from star_itsm_api.services.ticket_stakeholders import (
    upsert_stakeholder,
    validate_stakeholder_user_ids,
)


def _now() -> datetime:
    return datetime.now(UTC)


async def _require_staff_user(db: AsyncSession, user: User) -> uuid.UUID:
    if not is_staff(user):
        raise ValueError("staff_only")
    return await resolve_integration_organization_id(db, user)


async def get_ticket_channel(
    db: AsyncSession,
    ticket_id: uuid.UUID,
) -> TeamChatChannel | None:
    row = await db.execute(
        select(TeamChatChannel).where(
            TeamChatChannel.ticket_id == ticket_id,
            TeamChatChannel.channel_type == CHANNEL_TICKET,
        )
    )
    return row.scalar_one_or_none()


async def get_or_create_ticket_channel(
    db: AsyncSession,
    *,
    ticket: Ticket,
    creator: User,
    org_id: uuid.UUID,
) -> TeamChatChannel:
    existing = await get_ticket_channel(db, ticket.id)
    if existing is not None:
        mem = await db.execute(
            select(TeamChatChannelMember).where(
                TeamChatChannelMember.channel_id == existing.id,
                TeamChatChannelMember.user_id == creator.id,
            )
        )
        if mem.scalar_one_or_none() is None:
            db.add(
                TeamChatChannelMember(
                    channel_id=existing.id,
                    user_id=creator.id,
                    invited_by_user_id=None,
                )
            )
        return existing

    slug = f"ticket-{str(ticket.id).replace('-', '')[:32]}"
    channel = TeamChatChannel(
        organization_id=org_id,
        name=f"{ticket.ticket_number} — intern chat",
        slug=slug,
        description=f"Intern sagssamtale for {ticket.ticket_number}",
        is_private=True,
        is_system=False,
        channel_type=CHANNEL_TICKET,
        created_by=creator.id,
        ticket_id=ticket.id,
    )
    db.add(channel)
    await db.flush()
    db.add(
        TeamChatChannelMember(
            channel_id=channel.id,
            user_id=creator.id,
            invited_by_user_id=None,
        )
    )
    return channel


async def _ensure_channel_member(
    db: AsyncSession,
    *,
    channel: TeamChatChannel,
    user_id: uuid.UUID,
    invited_by_user_id: uuid.UUID | None,
) -> bool:
    """Add member if missing. Returns True when newly added."""
    mem = await db.execute(
        select(TeamChatChannelMember).where(
            TeamChatChannelMember.channel_id == channel.id,
            TeamChatChannelMember.user_id == user_id,
        )
    )
    if mem.scalar_one_or_none() is not None:
        return False
    db.add(
        TeamChatChannelMember(
            channel_id=channel.id,
            user_id=user_id,
            invited_by_user_id=invited_by_user_id,
        )
    )
    return True


async def invite_user_to_ticket_internal_chat(
    db: AsyncSession,
    *,
    ticket: Ticket,
    inviter: User,
    invitee_id: uuid.UUID,
    message: str | None = None,
    add_interested: bool = True,
    mention_snippet: str | None = None,
) -> TeamChatChannel:
    org_id = await _require_staff_user(db, inviter)
    if invitee_id == inviter.id:
        raise ValueError("self_invite")
    await validate_stakeholder_user_ids(db, [invitee_id])

    channel = await get_or_create_ticket_channel(
        db,
        ticket=ticket,
        creator=inviter,
        org_id=org_id,
    )

    if add_interested:
        await upsert_stakeholder(
            db,
            ticket_id=ticket.id,
            user_id=invitee_id,
            role="interested",
            now=_now(),
        )

    added = await _ensure_channel_member(
        db,
        channel=channel,
        user_id=invitee_id,
        invited_by_user_id=inviter.id,
    )

    invitee_name = await _user_display(db, invitee_id)
    inviter_name = inviter.display_name or "Kollega"

    if added:
        system_body = f"{inviter_name} indkaldte {invitee_name} til intern sagssamtale."
        db.add(
            TeamChatMessage(
                channel_id=channel.id,
                user_id=inviter.id,
                body=system_body,
                is_bot=False,
            )
        )

    if mention_snippet:
        db.add(
            TeamChatMessage(
                channel_id=channel.id,
                user_id=inviter.id,
                body=f"{inviter_name} nævnte {invitee_name}: {mention_snippet[:500]}",
                is_bot=False,
            )
        )
    elif message and message.strip():
        trimmed = message.strip()
        db.add(
            TeamChatMessage(
                channel_id=channel.id,
                user_id=inviter.id,
                body=trimmed,
                is_bot=False,
            )
        )

    await db.flush()
    return channel


async def get_ticket_internal_chat_read(
    db: AsyncSession,
    *,
    ticket: Ticket,
    user: User,
) -> TicketInternalChatRead | None:
    await _require_staff_user(db, user)
    channel = await get_ticket_channel(db, ticket.id)
    if channel is None:
        return TicketInternalChatRead(
            ticket_id=ticket.id,
            ticket_number=ticket.ticket_number,
            channel_id=None,
            messages=[],
        )

    mem = await db.execute(
        select(TeamChatChannelMember).where(
            TeamChatChannelMember.channel_id == channel.id,
            TeamChatChannelMember.user_id == user.id,
        )
    )
    if mem.scalar_one_or_none() is None:
        if channel.created_by == user.id:
            db.add(
                TeamChatChannelMember(
                    channel_id=channel.id,
                    user_id=user.id,
                    invited_by_user_id=None,
                )
            )
            await db.flush()
        else:
            return None

    rows = await db.execute(
        select(TeamChatMessage)
        .where(TeamChatMessage.channel_id == channel.id)
        .order_by(TeamChatMessage.created_at.asc())
        .limit(200)
    )
    messages = await _message_reads(db, list(rows.scalars().all()), user)
    return TicketInternalChatRead(
        ticket_id=ticket.id,
        ticket_number=ticket.ticket_number,
        channel_id=channel.id,
        messages=messages,
    )


async def post_ticket_internal_chat_message(
    db: AsyncSession,
    *,
    ticket: Ticket,
    user: User,
    body: str,
) -> TicketInternalChatRead:
    org_id = await _require_staff_user(db, user)
    channel = await get_or_create_ticket_channel(
        db,
        ticket=ticket,
        creator=user,
        org_id=org_id,
    )
    await _ensure_channel_member(
        db,
        channel=channel,
        user_id=user.id,
        invited_by_user_id=None,
    )
    await db.flush()
    await post_message(db, channel.id, user, body)
    read = await get_ticket_internal_chat_read(db, ticket=ticket, user=user)
    assert read is not None
    return read


async def list_personal_mentions_overview(
    db: AsyncSession,
    user: User,
    *,
    limit: int = 30,
) -> PersonalMentionsOverviewRead:
    cap = min(max(limit, 1), 100)
    items: list[PersonalMentionItemRead] = []

    mentioned_rows = await db.execute(
        select(TicketStakeholder, Ticket)
        .join(Ticket, TicketStakeholder.ticket_id == Ticket.id)
        .where(
            TicketStakeholder.user_id == user.id,
            TicketStakeholder.role == "mentioned",
            TicketStakeholder.deleted_at.is_(None),
            Ticket.deleted_at.is_(None),
        )
        .order_by(TicketStakeholder.created_at.desc())
        .limit(cap)
    )
    for stakeholder, ticket in mentioned_rows.all():
        items.append(
            PersonalMentionItemRead(
                kind="mention",
                ticket_id=ticket.id,
                ticket_number=ticket.ticket_number,
                ticket_title=ticket.title,
                channel_id=None,
                subtitle="Nævnt i kommentar",
                last_activity_at=stakeholder.created_at,
                invited_by_me=False,
            )
        )

    member_rows = await db.execute(
        select(TeamChatChannel, Ticket, TeamChatChannelMember)
        .join(Ticket, TeamChatChannel.ticket_id == Ticket.id)
        .join(
            TeamChatChannelMember,
            TeamChatChannelMember.channel_id == TeamChatChannel.id,
        )
        .where(
            TeamChatChannel.channel_type == CHANNEL_TICKET,
            TeamChatChannelMember.user_id == user.id,
            Ticket.deleted_at.is_(None),
        )
        .order_by(TeamChatChannel.updated_at.desc())
        .limit(cap)
    )

    seen_tickets: set[uuid.UUID] = {i.ticket_id for i in items}
    for channel, ticket, membership in member_rows.all():
        if ticket.id in seen_tickets:
            continue
        seen_tickets.add(ticket.id)

        last_msg = await db.execute(
            select(TeamChatMessage.body, TeamChatMessage.created_at)
            .where(TeamChatMessage.channel_id == channel.id)
            .order_by(TeamChatMessage.created_at.desc())
            .limit(1)
        )
        last_row = last_msg.first()
        preview = last_row[0][:120] if last_row and last_row[0] else "Intern sagssamtale"
        last_at = last_row[1] if last_row else channel.updated_at

        invited_by_me = (
            channel.created_by == user.id
            or await _user_invited_others_on_channel(db, channel.id, user.id)
        )
        kind = "invited" if invited_by_me else "participant"

        items.append(
            PersonalMentionItemRead(
                kind=kind,
                ticket_id=ticket.id,
                ticket_number=ticket.ticket_number,
                ticket_title=ticket.title,
                channel_id=channel.id,
                subtitle=preview,
                last_activity_at=last_at,
                invited_by_me=invited_by_me,
            )
        )

    items.sort(key=lambda i: i.last_activity_at, reverse=True)
    return PersonalMentionsOverviewRead(items=items[:cap])


async def sync_mentions_to_internal_chat(
    db: AsyncSession,
    *,
    ticket_id: uuid.UUID,
    author_user_id: uuid.UUID,
    mentioned_ids: list[uuid.UUID],
    body: str,
) -> None:
    """Staff @mentions: add invitees to internal ticket chat with snippet."""
    if not mentioned_ids:
        return
    author = await db.get(User, author_user_id)
    ticket = await db.get(Ticket, ticket_id)
    if author is None or ticket is None or ticket.deleted_at is not None:
        return
    if not is_staff(author):
        return
    snippet = body.strip()[:200]
    for invitee_id in mentioned_ids:
        await invite_user_to_ticket_internal_chat(
            db,
            ticket=ticket,
            inviter=author,
            invitee_id=invitee_id,
            add_interested=False,
            mention_snippet=snippet if snippet else None,
        )


async def _user_invited_others_on_channel(
    db: AsyncSession,
    channel_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    row = await db.execute(
        select(func.count())
        .select_from(TeamChatChannelMember)
        .where(
            TeamChatChannelMember.channel_id == channel_id,
            TeamChatChannelMember.invited_by_user_id == user_id,
        )
    )
    return int(row.scalar_one()) > 0
