"""Ticket stakeholder CRUD, entity graph edges, and @mention parsing."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import Select, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.entity_relationship import EntityRelationship
from star_itsm_api.models.ticket_stakeholder import STAKEHOLDER_ROLES, TicketStakeholder
from star_itsm_api.models.user import User
from star_itsm_api.schemas.stakeholder import (
    StakeholderUserRead,
    TicketStakeholderRead,
    TicketStakeholdersGroupedRead,
)
from star_itsm_api.services.db_resilience import optional_db_read

EDITABLE_STAKEHOLDER_ROLES = frozenset({"affected", "interested"})
RELATIONSHIP_TYPE_BY_ROLE = {
    "affected": "affected",
    "interested": "interested",
    "mentioned": "mentioned_in_comment",
    "requester": "created",
}

_MENTION_EMAIL = re.compile(r"@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})")
_MENTION_NAME = re.compile(r"@([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9._\- ]{1,60})")

logger = logging.getLogger(__name__)


def empty_stakeholders_grouped() -> TicketStakeholdersGroupedRead:
    """Default payload when stakeholder tables are unavailable or empty."""
    return TicketStakeholdersGroupedRead()


def _now() -> datetime:
    return datetime.now(UTC)


async def _load_users_map(
    db: AsyncSession,
    user_ids: set[uuid.UUID],
) -> dict[uuid.UUID, User]:
    if not user_ids:
        return {}
    rows = await db.execute(
        select(User).where(
            User.id.in_(user_ids),
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
    )
    return {user.id: user for user in rows.scalars().all()}


async def validate_stakeholder_user_ids(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
) -> None:
    if not user_ids:
        return
    unique = set(user_ids)
    found = await _load_users_map(db, unique)
    missing = unique - set(found.keys())
    if missing:
        raise ValueError("Invalid user id in stakeholder list")


def record_entity_relationship(
    db: AsyncSession,
    *,
    source_type: str,
    source_id: uuid.UUID,
    target_type: str,
    target_id: uuid.UUID,
    relationship_type: str,
    metadata: dict | None = None,
    now: datetime | None = None,
) -> EntityRelationship:
    ts = now or _now()
    row = EntityRelationship(
        id=uuid.uuid4(),
        source_type=source_type,
        source_id=source_id,
        target_type=target_type,
        target_id=target_id,
        relationship_type=relationship_type,
        metadata_=metadata or {},
        created_at=ts,
        updated_at=ts,
        deleted_at=None,
    )
    db.add(row)
    return row


def record_ticket_user_relationship(
    db: AsyncSession,
    *,
    ticket_id: uuid.UUID,
    user_id: uuid.UUID,
    role: str,
    metadata: dict | None = None,
    now: datetime | None = None,
) -> None:
    rel_type = RELATIONSHIP_TYPE_BY_ROLE.get(role, role)
    record_entity_relationship(
        db,
        source_type="user",
        source_id=user_id,
        target_type="ticket",
        target_id=ticket_id,
        relationship_type=rel_type,
        metadata=metadata,
        now=now,
    )


async def _get_active_stakeholder(
    db: AsyncSession,
    *,
    ticket_id: uuid.UUID,
    user_id: uuid.UUID,
    role: str,
) -> TicketStakeholder | None:
    result = await db.execute(
        select(TicketStakeholder).where(
            TicketStakeholder.ticket_id == ticket_id,
            TicketStakeholder.user_id == user_id,
            TicketStakeholder.role == role,
            TicketStakeholder.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def upsert_stakeholder(
    db: AsyncSession,
    *,
    ticket_id: uuid.UUID,
    user_id: uuid.UUID,
    role: str,
    now: datetime | None = None,
    metadata: dict | None = None,
) -> TicketStakeholder:
    if role not in STAKEHOLDER_ROLES:
        raise ValueError(f"Invalid stakeholder role: {role}")
    ts = now or _now()
    existing = await _get_active_stakeholder(db, ticket_id=ticket_id, user_id=user_id, role=role)
    if existing is not None:
        existing.updated_at = ts
        return existing
    row = TicketStakeholder(
        id=uuid.uuid4(),
        ticket_id=ticket_id,
        user_id=user_id,
        role=role,
        created_at=ts,
        updated_at=ts,
        deleted_at=None,
    )
    db.add(row)
    record_ticket_user_relationship(
        db,
        ticket_id=ticket_id,
        user_id=user_id,
        role=role,
        metadata=metadata,
        now=ts,
    )
    return row


async def sync_role_stakeholders(
    db: AsyncSession,
    *,
    ticket_id: uuid.UUID,
    role: str,
    user_ids: list[uuid.UUID],
    now: datetime | None = None,
) -> None:
    if role not in EDITABLE_STAKEHOLDER_ROLES:
        raise ValueError(f"Role cannot be synced: {role}")
    ts = now or _now()
    desired = set(user_ids)

    active_rows = await db.execute(
        select(TicketStakeholder).where(
            TicketStakeholder.ticket_id == ticket_id,
            TicketStakeholder.role == role,
            TicketStakeholder.deleted_at.is_(None),
        )
    )
    for row in active_rows.scalars().all():
        if row.user_id is None or row.user_id not in desired:
            row.deleted_at = ts
            row.updated_at = ts

    for user_id in desired:
        await upsert_stakeholder(db, ticket_id=ticket_id, user_id=user_id, role=role, now=ts)


async def sync_ticket_stakeholders_on_create(
    db: AsyncSession,
    *,
    ticket_id: uuid.UUID,
    reporter_user_id: uuid.UUID,
    affected_user_ids: list[uuid.UUID],
    interested_user_ids: list[uuid.UUID],
    now: datetime | None = None,
) -> None:
    ts = now or _now()
    record_ticket_user_relationship(
        db,
        ticket_id=ticket_id,
        user_id=reporter_user_id,
        role="requester",
        now=ts,
    )
    await upsert_stakeholder(
        db,
        ticket_id=ticket_id,
        user_id=reporter_user_id,
        role="requester",
        now=ts,
    )
    if affected_user_ids:
        await validate_stakeholder_user_ids(db, affected_user_ids)
        await sync_role_stakeholders(
            db, ticket_id=ticket_id, role="affected", user_ids=affected_user_ids, now=ts
        )
    if interested_user_ids:
        await validate_stakeholder_user_ids(db, interested_user_ids)
        await sync_role_stakeholders(
            db, ticket_id=ticket_id, role="interested", user_ids=interested_user_ids, now=ts
        )


async def list_stakeholders_for_ticket(
    db: AsyncSession,
    ticket_id: uuid.UUID,
) -> list[TicketStakeholder]:
    result = await db.execute(
        select(TicketStakeholder)
        .where(
            TicketStakeholder.ticket_id == ticket_id,
            TicketStakeholder.deleted_at.is_(None),
        )
        .order_by(TicketStakeholder.created_at.asc())
    )
    return list(result.scalars().all())


async def stakeholders_to_grouped_read(
    db: AsyncSession,
    rows: list[TicketStakeholder],
) -> TicketStakeholdersGroupedRead:
    user_ids = {row.user_id for row in rows if row.user_id is not None}
    users = await _load_users_map(db, user_ids)

    grouped: dict[str, list[StakeholderUserRead]] = {
        "affected": [],
        "interested": [],
        "mentioned": [],
    }
    for row in rows:
        if row.user_id is None or row.role not in grouped:
            continue
        user = users.get(row.user_id)
        if user is None:
            continue
        grouped[row.role].append(
            StakeholderUserRead(
                user_id=user.id,
                display_name=user.display_name,
                email=user.email,
            )
        )
    return TicketStakeholdersGroupedRead(**grouped)


async def get_ticket_stakeholders_grouped(
    db: AsyncSession,
    ticket_id: uuid.UUID,
) -> TicketStakeholdersGroupedRead:
    async def _load() -> TicketStakeholdersGroupedRead:
        rows = await list_stakeholders_for_ticket(db, ticket_id)
        return await stakeholders_to_grouped_read(db, rows)

    return await optional_db_read(
        db,
        _load,
        default=empty_stakeholders_grouped(),
        log_message=f"Could not load stakeholders for ticket {ticket_id}; returning empty groups",
    )


async def stakeholder_to_read(
    db: AsyncSession,
    row: TicketStakeholder,
) -> TicketStakeholderRead:
    display_name: str | None = None
    email: str | None = None
    if row.user_id is not None:
        user = await db.get(User, row.user_id)
        if user is not None:
            display_name = user.display_name
            email = user.email
    return TicketStakeholderRead(
        id=row.id,
        ticket_id=row.ticket_id,
        user_id=row.user_id,
        role=row.role,  # type: ignore[arg-type]
        display_name=display_name,
        email=email,
        created_at=row.created_at,
    )


def soft_delete_stakeholder(
    _db: AsyncSession,
    row: TicketStakeholder,
    *,
    now: datetime | None = None,
) -> None:
    ts = now or _now()
    row.deleted_at = ts
    row.updated_at = ts


def apply_stakeholder_ticket_filter(
    stmt: Select,
    *,
    user_id: uuid.UUID,
) -> Select:
    """Tickets where user is reporter or active stakeholder."""
    from star_itsm_api.models.ticket import Ticket

    subq = (
        select(TicketStakeholder.ticket_id)
        .where(
            TicketStakeholder.user_id == user_id,
            TicketStakeholder.deleted_at.is_(None),
        )
        .distinct()
    )
    return stmt.where(
        or_(
            Ticket.reporter_user_id == user_id,
            Ticket.id.in_(subq),
        )
    )


def _extract_mention_tokens(body: str) -> list[str]:
    tokens: list[str] = []
    for match in _MENTION_EMAIL.finditer(body):
        tokens.append(match.group(1).strip())
    for match in _MENTION_NAME.finditer(body):
        candidate = match.group(1).strip()
        if "@" in candidate:
            continue
        if any(candidate == t for t in tokens):
            continue
        tokens.append(candidate)
    return tokens


def _resolve_token_to_user_id(
    users: list[User],
    token_lower: str,
    *,
    exclude_user_id: uuid.UUID | None,
    seen: set[uuid.UUID],
) -> uuid.UUID | None:
    for user in users:
        if exclude_user_id is not None and user.id == exclude_user_id:
            continue
        if user.email.lower() == token_lower or user.display_name.lower() == token_lower:
            if user.id in seen:
                return None
            seen.add(user.id)
            return user.id
    return None


async def resolve_mentioned_user_ids(
    db: AsyncSession,
    body: str,
    *,
    exclude_user_id: uuid.UUID | None = None,
) -> list[uuid.UUID]:
    tokens = _extract_mention_tokens(body)
    if not tokens:
        return []
    result = await db.execute(
        select(User).where(User.deleted_at.is_(None), User.is_active.is_(True))
    )
    users = list(result.scalars().all())
    resolved: list[uuid.UUID] = []
    seen: set[uuid.UUID] = set()
    for token in tokens:
        user_id = _resolve_token_to_user_id(
            users, token.lower(), exclude_user_id=exclude_user_id, seen=seen,
        )
        if user_id is not None:
            resolved.append(user_id)
    return resolved


async def process_comment_mentions(
    db: AsyncSession,
    *,
    ticket_id: uuid.UUID,
    comment_id: uuid.UUID,
    body: str,
    author_user_id: uuid.UUID,
    now: datetime | None = None,
) -> list[uuid.UUID]:
    mentioned_ids = await resolve_mentioned_user_ids(
        db,
        body,
        exclude_user_id=author_user_id,
    )
    ts = now or _now()
    for user_id in mentioned_ids:
        await upsert_stakeholder(
            db,
            ticket_id=ticket_id,
            user_id=user_id,
            role="mentioned",
            now=ts,
            metadata={"comment_id": str(comment_id)},
        )
    return mentioned_ids
