"""CMDB audit log — searchable, cursor pagination with byte budget."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.cmdb_audit_log import CmdbAuditLog
from star_itsm_api.models.user import User
from star_itsm_api.schemas.cmdb import CmdbAuditCreate, CmdbAuditEntryRead, CmdbAuditLogPage

DEFAULT_BYTE_BUDGET = 1_048_576
MAX_ROWS_PER_PAGE = 500


def _build_search_text(
    *,
    action: str,
    entity_type: str,
    entity_id: str,
    entity_label: str,
    actor_display_name: str,
    summary_da: str,
) -> str:
    return " ".join(
        part.strip().lower()
        for part in (
            action,
            entity_type,
            entity_id,
            entity_label,
            actor_display_name,
            summary_da,
        )
        if part and part.strip()
    )


def _entry_bytes(entry: CmdbAuditEntryRead) -> int:
    return len(json.dumps(entry.model_dump(mode="json"), ensure_ascii=False))


async def append_audit_entry(
    db: AsyncSession,
    *,
    actor: User,
    payload: CmdbAuditCreate,
) -> CmdbAuditLog:
    now = datetime.now(UTC)
    summary = payload.summary_da.strip()
    if not summary:
        summary = _default_summary_da(
            actor_display_name=actor.display_name,
            action=payload.action,
            entity_label=payload.entity_label or payload.entity_id,
        )
    row = CmdbAuditLog(
        id=uuid.uuid4(),
        created_at=now,
        actor_user_id=actor.id,
        actor_display_name=actor.display_name,
        action=payload.action,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        entity_label=payload.entity_label or payload.entity_id,
        changes=payload.changes,
        summary_da=summary,
        search_text=_build_search_text(
            action=payload.action,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            entity_label=payload.entity_label or payload.entity_id,
            actor_display_name=actor.display_name,
            summary_da=summary,
        ),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


def _default_summary_da(
    *,
    actor_display_name: str,
    action: str,
    entity_label: str,
) -> str:
    verbs = {
        "create": "oprettede",
        "update": "opdaterede",
        "delete": "slettede",
        "connection_add": "tilføjede forbindelse for",
        "connection_remove": "fjernede forbindelse for",
    }
    verb = verbs.get(action, "ændrede")
    return f"{actor_display_name} {verb} «{entity_label}»"


def _to_read(row: CmdbAuditLog) -> CmdbAuditEntryRead:
    return CmdbAuditEntryRead(
        id=row.id,
        created_at=row.created_at,
        actor_user_id=row.actor_user_id,
        actor_display_name=row.actor_display_name,
        action=row.action,
        entity_type=row.entity_type,
        entity_id=row.entity_id,
        entity_label=row.entity_label,
        changes=row.changes,
        summary_da=row.summary_da,
    )


async def list_audit_log(
    db: AsyncSession,
    *,
    before_id: uuid.UUID | None = None,
    byte_budget: int = DEFAULT_BYTE_BUDGET,
    search: str | None = None,
) -> CmdbAuditLogPage:
    stmt = select(CmdbAuditLog).order_by(CmdbAuditLog.created_at.desc(), CmdbAuditLog.id.desc())

    if before_id is not None:
        anchor = await db.get(CmdbAuditLog, before_id)
        if anchor is not None:
            stmt = stmt.where(
                (CmdbAuditLog.created_at < anchor.created_at)
                | ((CmdbAuditLog.created_at == anchor.created_at) & (CmdbAuditLog.id < anchor.id))
            )

    q = (search or "").strip().lower()
    if q:
        stmt = stmt.where(CmdbAuditLog.search_text.ilike(f"%{q}%"))

    stmt = stmt.limit(MAX_ROWS_PER_PAGE)
    result = await db.execute(stmt)
    rows = list(result.scalars().all())

    items: list[CmdbAuditEntryRead] = []
    total_bytes = 0
    for row in rows:
        entry = _to_read(row)
        size = _entry_bytes(entry)
        if items and total_bytes + size > byte_budget:
            break
        items.append(entry)
        total_bytes += size

    has_more = len(rows) > len(items) or (
        len(items) == len(rows) and len(rows) == MAX_ROWS_PER_PAGE
    )
    next_before = items[-1].id if items and has_more else None

    return CmdbAuditLogPage(
        items=items,
        has_more=has_more,
        next_before_id=next_before,
        approx_bytes=total_bytes,
    )
