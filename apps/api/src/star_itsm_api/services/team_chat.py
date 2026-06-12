"""Internal team chat workspace (Slack-like channels for staff)."""

from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import is_staff
from star_itsm_api.models.team_chat import (
    CHANNEL_BOT,
    CHANNEL_DM,
    CHANNEL_PRIVATE,
    CHANNEL_PUBLIC,
    TeamChatChannel,
    TeamChatChannelMember,
    TeamChatMessage,
    TeamChatMessageReaction,
)
from star_itsm_api.models.user import User
from star_itsm_api.routers.chat import ChatMessage, ChatRequest, get_smart_mock_response
from star_itsm_api.schemas.team_chat import (
    TeamChatChannelCreate,
    TeamChatChannelRead,
    TeamChatMessageRead,
    TeamChatReactionRead,
    TeamChatStaffRead,
)
from star_itsm_api.services.org_access import (
    IntegrationOrganizationError,
    resolve_integration_organization_id,
)

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_BOT_SLUG = "help-a-bot"

_DEFAULT_CHANNELS: tuple[tuple[str, str, str, str], ...] = (
    ("general", "general", "Generelle drøftinger", CHANNEL_PUBLIC),
    ("it-support", "it-support", "IT-support og fejlsøgning", CHANNEL_PUBLIC),
    ("sagsdeling", "sagsdeling", "Sagsdeling og routing", CHANNEL_PUBLIC),
    (_BOT_SLUG, "help-a-bot", "Help-a-bot med tool calling", CHANNEL_BOT),
)


def _slugify(name: str) -> str:
    base = name.lower().strip()
    base = re.sub(r"[^a-z0-9]+", "-", base)
    base = base.strip("-")
    return base[:80] or "kanal"


async def _user_display(db: AsyncSession, user_id: uuid.UUID | None) -> str:
    if user_id is None:
        return "Help-a-bot"
    row = await db.execute(
        select(User.display_name).where(User.id == user_id, User.deleted_at.is_(None))
    )
    return row.scalar_one_or_none() or "Bruger"


async def resolve_org_id(db: AsyncSession, user: User) -> uuid.UUID:
    if not is_staff(user):
        raise IntegrationOrganizationError("Kun interne medarbejdere har adgang til team-chat.")
    return await resolve_integration_organization_id(db, user)


async def ensure_default_channels(db: AsyncSession, org_id: uuid.UUID) -> None:
    for slug, name, description, channel_type in _DEFAULT_CHANNELS:
        existing = await db.execute(
            select(TeamChatChannel.id).where(
                TeamChatChannel.organization_id == org_id,
                TeamChatChannel.slug == slug,
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue
        db.add(
            TeamChatChannel(
                organization_id=org_id,
                name=name,
                slug=slug,
                description=description,
                is_private=False,
                is_system=True,
                channel_type=channel_type,
                created_by=None,
            )
        )
    await db.commit()


async def _channel_visible_to_user(
    db: AsyncSession,
    channel: TeamChatChannel,
    user: User,
) -> bool:
    if channel.channel_type in (CHANNEL_PUBLIC, CHANNEL_BOT):
        return True
    if channel.channel_type == CHANNEL_DM:
        member = await db.execute(
            select(TeamChatChannelMember.user_id).where(
                TeamChatChannelMember.channel_id == channel.id,
                TeamChatChannelMember.user_id == user.id,
            )
        )
        return member.scalar_one_or_none() is not None
    if channel.is_private or channel.channel_type == CHANNEL_PRIVATE:
        member = await db.execute(
            select(TeamChatChannelMember.user_id).where(
                TeamChatChannelMember.channel_id == channel.id,
                TeamChatChannelMember.user_id == user.id,
            )
        )
        return member.scalar_one_or_none() is not None
    return True


async def get_channel_for_user(
    db: AsyncSession,
    channel_id: uuid.UUID,
    user: User,
) -> TeamChatChannel | None:
    org_id = await resolve_org_id(db, user)
    row = await db.execute(
        select(TeamChatChannel).where(
            TeamChatChannel.id == channel_id,
            TeamChatChannel.organization_id == org_id,
        )
    )
    channel = row.scalar_one_or_none()
    if channel is None:
        return None
    if not await _channel_visible_to_user(db, channel, user):
        return None
    return channel


async def list_channels(db: AsyncSession, user: User) -> list[TeamChatChannelRead]:
    org_id = await resolve_org_id(db, user)
    await ensure_default_channels(db, org_id)

    member_channel_ids = select(TeamChatChannelMember.channel_id).where(
        TeamChatChannelMember.user_id == user.id
    )
    rows = await db.execute(
        select(TeamChatChannel)
        .where(
            TeamChatChannel.organization_id == org_id,
            or_(
                TeamChatChannel.channel_type.in_((CHANNEL_PUBLIC, CHANNEL_BOT)),
                and_(
                    TeamChatChannel.channel_type.in_((CHANNEL_PRIVATE, CHANNEL_DM)),
                    TeamChatChannel.id.in_(member_channel_ids),
                ),
            ),
        )
        .order_by(TeamChatChannel.is_system.desc(), TeamChatChannel.name.asc())
    )
    channels = rows.scalars().all()
    result: list[TeamChatChannelRead] = []
    for ch in channels:
        last_msg = await db.execute(
            select(TeamChatMessage.body, TeamChatMessage.created_at)
            .where(TeamChatMessage.channel_id == ch.id)
            .order_by(TeamChatMessage.created_at.desc())
            .limit(1)
        )
        last_row = last_msg.first()
        preview = None
        last_at = None
        if last_row:
            preview = last_row[0][:120] if last_row[0] else None
            last_at = last_row[1]
        result.append(
            TeamChatChannelRead(
                id=ch.id,
                name=ch.name,
                slug=ch.slug,
                description=ch.description,
                is_private=ch.is_private,
                is_system=ch.is_system,
                channel_type=ch.channel_type,
                unread_count=0,
                last_message_at=last_at,
                last_message_preview=preview,
            )
        )
    return result


async def create_channel(
    db: AsyncSession,
    user: User,
    body: TeamChatChannelCreate,
) -> TeamChatChannelRead:
    org_id = await resolve_org_id(db, user)
    slug = _slugify(body.name)
    if not _SLUG_RE.match(slug):
        slug = f"kanal-{uuid.uuid4().hex[:6]}"
    existing = await db.execute(
        select(TeamChatChannel.id).where(
            TeamChatChannel.organization_id == org_id,
            TeamChatChannel.slug == slug,
        )
    )
    if existing.scalar_one_or_none() is not None:
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    channel_type = CHANNEL_PRIVATE if body.is_private else CHANNEL_PUBLIC
    channel = TeamChatChannel(
        organization_id=org_id,
        name=body.name.strip(),
        slug=slug,
        description=body.description,
        is_private=body.is_private,
        is_system=False,
        channel_type=channel_type,
        created_by=user.id,
    )
    db.add(channel)
    await db.flush()
    if body.is_private:
        db.add(TeamChatChannelMember(channel_id=channel.id, user_id=user.id))
    await db.commit()
    await db.refresh(channel)
    return TeamChatChannelRead(
        id=channel.id,
        name=channel.name,
        slug=channel.slug,
        description=channel.description,
        is_private=channel.is_private,
        is_system=channel.is_system,
        channel_type=channel.channel_type,
    )


async def _reactions_for_messages(
    db: AsyncSession,
    message_ids: list[uuid.UUID],
    user_id: uuid.UUID,
) -> dict[uuid.UUID, list[TeamChatReactionRead]]:
    if not message_ids:
        return {}
    rows = await db.execute(
        select(
            TeamChatMessageReaction.message_id,
            TeamChatMessageReaction.emoji,
            func.count().label("cnt"),
            func.bool_or(TeamChatMessageReaction.user_id == user_id).label("mine"),
        )
        .where(TeamChatMessageReaction.message_id.in_(message_ids))
        .group_by(TeamChatMessageReaction.message_id, TeamChatMessageReaction.emoji)
    )
    out: dict[uuid.UUID, list[TeamChatReactionRead]] = {}
    for msg_id, emoji, cnt, mine in rows.all():
        out.setdefault(msg_id, []).append(
            TeamChatReactionRead(emoji=emoji, count=int(cnt), reacted_by_me=bool(mine))
        )
    return out


async def _message_reads(
    db: AsyncSession,
    messages: list[TeamChatMessage],
    user: User,
) -> list[TeamChatMessageRead]:
    if not messages:
        return []
    ids = [m.id for m in messages]
    reactions = await _reactions_for_messages(db, ids, user.id)
    reads: list[TeamChatMessageRead] = []
    for m in messages:
        reads.append(
            TeamChatMessageRead(
                id=m.id,
                channel_id=m.channel_id,
                sender_user_id=m.user_id,
                sender_display_name=await _user_display(db, m.user_id if not m.is_bot else None),
                body=m.body,
                is_bot=m.is_bot,
                is_own=m.user_id == user.id and not m.is_bot,
                tool_call_meta=m.tool_call_meta,
                reactions=reactions.get(m.id, []),
                created_at=m.created_at,
            )
        )
    return reads


async def list_messages(
    db: AsyncSession,
    channel_id: uuid.UUID,
    user: User,
    *,
    after: datetime | None = None,
    limit: int = 100,
) -> list[TeamChatMessageRead]:
    channel = await get_channel_for_user(db, channel_id, user)
    if channel is None:
        return []
    query = (
        select(TeamChatMessage)
        .where(TeamChatMessage.channel_id == channel_id)
        .order_by(TeamChatMessage.created_at.asc())
        .limit(min(limit, 200))
    )
    if after is not None:
        query = query.where(TeamChatMessage.created_at > after)
    rows = await db.execute(query)
    return await _message_reads(db, list(rows.scalars().all()), user)


async def _generate_bot_reply(
    db: AsyncSession,
    channel_id: uuid.UUID,
    user: User,
    user_body: str,
) -> tuple[str, dict[str, Any] | None]:
    history_rows = await db.execute(
        select(TeamChatMessage.body, TeamChatMessage.is_bot)
        .where(TeamChatMessage.channel_id == channel_id)
        .order_by(TeamChatMessage.created_at.desc())
        .limit(20)
    )
    chat_messages: list[ChatMessage] = []
    for body, is_bot in reversed(history_rows.all()):
        role = "assistant" if is_bot else "user"
        chat_messages.append(ChatMessage(role=role, content=body))
    chat_messages.append(ChatMessage(role="user", content=user_body))
    request = ChatRequest(messages=chat_messages, model_override="gemini-1.5-flash")
    text = await get_smart_mock_response(request, user)
    tool_meta: dict[str, Any] | None = None
    if "🔧" in text or "tool" in text.lower():
        tool_meta = {"source": "help-a-bot", "tools_used": True}
    return text, tool_meta


async def post_message(
    db: AsyncSession,
    channel_id: uuid.UUID,
    user: User,
    body: str,
) -> list[TeamChatMessageRead]:
    channel = await get_channel_for_user(db, channel_id, user)
    if channel is None:
        raise ValueError("channel_not_found")

    trimmed = body.strip()
    if not trimmed:
        raise ValueError("empty_body")

    user_msg = TeamChatMessage(
        channel_id=channel_id,
        user_id=user.id,
        body=trimmed,
        is_bot=False,
    )
    db.add(user_msg)
    await db.flush()
    created = [user_msg]

    if channel.channel_type == CHANNEL_BOT or channel.slug == _BOT_SLUG:
        reply_text, tool_meta = await _generate_bot_reply(db, channel_id, user, trimmed)
        bot_msg = TeamChatMessage(
            channel_id=channel_id,
            user_id=None,
            body=reply_text,
            is_bot=True,
            tool_call_meta=tool_meta,
        )
        db.add(bot_msg)
        created.append(bot_msg)

    await db.commit()
    for m in created:
        await db.refresh(m)
    return await _message_reads(db, created, user)


async def toggle_reaction(
    db: AsyncSession,
    message_id: uuid.UUID,
    user: User,
    emoji: str,
) -> list[TeamChatReactionRead]:
    msg_row = await db.execute(
        select(TeamChatMessage).where(TeamChatMessage.id == message_id)
    )
    msg = msg_row.scalar_one_or_none()
    if msg is None:
        raise ValueError("message_not_found")
    channel = await get_channel_for_user(db, msg.channel_id, user)
    if channel is None:
        raise ValueError("channel_not_found")

    existing = await db.execute(
        select(TeamChatMessageReaction).where(
            TeamChatMessageReaction.message_id == message_id,
            TeamChatMessageReaction.user_id == user.id,
            TeamChatMessageReaction.emoji == emoji,
        )
    )
    row = existing.scalar_one_or_none()
    if row is not None:
        await db.delete(row)
    else:
        db.add(
            TeamChatMessageReaction(
                message_id=message_id,
                user_id=user.id,
                emoji=emoji,
            )
        )
    await db.commit()
    reactions = await _reactions_for_messages(db, [message_id], user.id)
    return reactions.get(message_id, [])


async def list_staff(db: AsyncSession, user: User) -> list[TeamChatStaffRead]:
    org_id = await resolve_org_id(db, user)
    rows = await db.execute(
        select(User.id, User.display_name, User.email)
        .where(
            User.deleted_at.is_(None),
            User.is_active.is_(True),
            User.id != user.id,
            User.role.in_(("agent", "admin", "top_admin", "supporter")),
            or_(User.organization_id == org_id, User.organization_id.is_(None)),
        )
        .order_by(User.display_name.asc())
        .limit(100)
    )
    return [
        TeamChatStaffRead(id=r[0], display_name=r[1], email=r[2])
        for r in rows.all()
    ]


async def get_or_create_dm(
    db: AsyncSession,
    user: User,
    other_user_id: uuid.UUID,
) -> TeamChatChannelRead:
    if other_user_id == user.id:
        raise ValueError("self_dm")
    org_id = await resolve_org_id(db, user)
    other = await db.execute(
        select(User).where(
            User.id == other_user_id,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
    )
    if other.scalar_one_or_none() is None:
        raise ValueError("user_not_found")

    pair = sorted([str(user.id), str(other_user_id)])
    dm_slug = f"dm-{'-'.join(pair)}"

    existing = await db.execute(
        select(TeamChatChannel).where(
            TeamChatChannel.organization_id == org_id,
            TeamChatChannel.slug == dm_slug,
        )
    )
    channel = existing.scalar_one_or_none()
    if channel is None:
        other_name = await _user_display(db, other_user_id)
        channel = TeamChatChannel(
            organization_id=org_id,
            name=other_name,
            slug=dm_slug,
            description=None,
            is_private=True,
            is_system=False,
            channel_type=CHANNEL_DM,
            created_by=user.id,
        )
        db.add(channel)
        await db.flush()
        db.add(TeamChatChannelMember(channel_id=channel.id, user_id=user.id))
        db.add(TeamChatChannelMember(channel_id=channel.id, user_id=other_user_id))
        await db.commit()
        await db.refresh(channel)
    else:
        for uid in (user.id, other_user_id):
            mem = await db.execute(
                select(TeamChatChannelMember).where(
                    TeamChatChannelMember.channel_id == channel.id,
                    TeamChatChannelMember.user_id == uid,
                )
            )
            if mem.scalar_one_or_none() is None:
                db.add(TeamChatChannelMember(channel_id=channel.id, user_id=uid))
        await db.commit()

    return TeamChatChannelRead(
        id=channel.id,
        name=channel.name,
        slug=channel.slug,
        description=channel.description,
        is_private=channel.is_private,
        is_system=channel.is_system,
        channel_type=channel.channel_type,
    )
