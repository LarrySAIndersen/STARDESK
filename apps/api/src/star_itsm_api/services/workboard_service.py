"""Work Board task CRUD — Neon is source of truth."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.workboard import WorkboardTask
from star_itsm_api.schemas.workboard import (
    WorkboardBulkImportResult,
    WorkboardTaskCreate,
    WorkboardTaskRead,
    WorkboardTaskUpdate,
)
from star_itsm_api.services.workboard_mapping import (
    apply_canvas_payload_to_row,
    new_row_from_canvas,
    row_to_canvas_dict,
    split_canvas_payload,
)
from star_itsm_api.services.workboard_status_guard import resolve_persisted_status


def _now() -> datetime:
    return datetime.now(UTC)


def _task_query(*, include_deleted: bool = False):
    q = select(WorkboardTask)
    if not include_deleted:
        q = q.where(WorkboardTask.deleted_at.is_(None))
    return q


async def _resolve_parent_id(
    db: AsyncSession,
    parent_canvas_id: str | None,
) -> uuid.UUID | None:
    if not parent_canvas_id:
        return None
    result = await db.execute(
        select(WorkboardTask.id).where(
            WorkboardTask.canvas_id == parent_canvas_id,
            WorkboardTask.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def _next_task_number(db: AsyncSession) -> int:
    result = await db.execute(select(func.coalesce(func.max(WorkboardTask.number), 0)))
    current = int(result.scalar_one())
    return current + 1


def _read_from_row(row: WorkboardTask) -> WorkboardTaskRead:
    return WorkboardTaskRead.model_validate(row_to_canvas_dict(row))


async def list_tasks(
    db: AsyncSession,
    *,
    status: str | None = None,
) -> list[WorkboardTaskRead]:
    q = _task_query().order_by(WorkboardTask.number.asc())
    if status:
        q = q.where(WorkboardTask.status == status)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [_read_from_row(row) for row in rows]


async def get_task_by_canvas_id(db: AsyncSession, canvas_id: str) -> WorkboardTaskRead:
    result = await db.execute(_task_query().where(WorkboardTask.canvas_id == canvas_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise LookupError(canvas_id)
    return _read_from_row(row)


async def get_task_by_number(db: AsyncSession, number: int) -> WorkboardTaskRead:
    result = await db.execute(_task_query().where(WorkboardTask.number == number))
    row = result.scalar_one_or_none()
    if row is None:
        raise LookupError(str(number))
    return _read_from_row(row)


async def get_task_by_uuid(db: AsyncSession, task_id: uuid.UUID) -> WorkboardTaskRead:
    result = await db.execute(_task_query().where(WorkboardTask.id == task_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise LookupError(str(task_id))
    return _read_from_row(row)


async def create_task(db: AsyncSession, payload: WorkboardTaskCreate) -> WorkboardTaskRead:
    raw = payload.model_dump(by_alias=True, exclude_none=True)
    number = payload.number
    if number is None:
        number = await _next_task_number(db)
    canvas_id = payload.id or f"t-{number}"
    raw["id"] = canvas_id
    raw["number"] = number

    existing = await db.execute(
        select(WorkboardTask).where(
            (WorkboardTask.canvas_id == canvas_id) | (WorkboardTask.number == number)
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError("Task with same id or number already exists")

    parent_uuid = await _resolve_parent_id(db, payload.parentId)
    row = new_row_from_canvas(raw, parent_uuid=parent_uuid)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _read_from_row(row)


async def update_task(
    db: AsyncSession,
    *,
    canvas_id: str | None = None,
    task_id: uuid.UUID | None = None,
    number: int | None = None,
    payload: WorkboardTaskUpdate,
) -> WorkboardTaskRead:
    q = _task_query()
    if canvas_id:
        q = q.where(WorkboardTask.canvas_id == canvas_id)
    elif task_id:
        q = q.where(WorkboardTask.id == task_id)
    elif number is not None:
        q = q.where(WorkboardTask.number == number)
    else:
        raise ValueError("Task identifier required")

    result = await db.execute(q)
    row = result.scalar_one_or_none()
    if row is None:
        raise LookupError("task")

    merge = row_to_canvas_dict(row)
    patch = payload.model_dump(by_alias=True, exclude_unset=True)
    merge.update(patch)
    status_override: str | None = None
    if "status" in patch and patch["status"] is not None:
        resolved, _preserved = resolve_persisted_status(row.status, str(patch["status"]))
        status_override = resolved
        merge["status"] = resolved
    parent_uuid = await _resolve_parent_id(
        db,
        merge.get("parentId") or merge.get("parent_id"),
    )
    apply_canvas_payload_to_row(
        row,
        merge,
        parent_uuid=parent_uuid,
        status_override=status_override,
    )
    await db.commit()
    await db.refresh(row)
    return _read_from_row(row)


async def patch_task_from_canvas_dict(
    db: AsyncSession,
    raw: dict[str, Any],
) -> WorkboardTaskRead:
    canvas_id = str(raw.get("id") or "").strip()
    if not canvas_id:
        raise ValueError("Canvas task id is required")
    result = await db.execute(_task_query().where(WorkboardTask.canvas_id == canvas_id))
    row = result.scalar_one_or_none()
    parent_uuid = await _resolve_parent_id(
        db,
        raw.get("parentId") or raw.get("parent_id"),
    )
    if row is None:
        row = new_row_from_canvas(raw, parent_uuid=parent_uuid)
        db.add(row)
    else:
        columns, _, _, _ = split_canvas_payload(raw)
        resolved, _preserved = resolve_persisted_status(row.status, columns["status"])
        apply_canvas_payload_to_row(
            row,
            raw,
            parent_uuid=parent_uuid,
            status_override=resolved,
        )
    await db.commit()
    await db.refresh(row)
    return _read_from_row(row)


async def bulk_import(
    db: AsyncSession,
    tasks: list[dict[str, Any]],
    *,
    replace_missing: bool = False,
) -> WorkboardBulkImportResult:
    stats = WorkboardBulkImportResult()
    status_preserved = 0
    seen_canvas_ids: set[str] = set()

    for raw in tasks:
        columns, _, _, _ = split_canvas_payload(raw)
        canvas_id = columns["canvas_id"]
        if not canvas_id:
            stats.skipped += 1
            continue
        seen_canvas_ids.add(canvas_id)

    # First pass: upsert rows without parent FK resolution
    canvas_to_row: dict[str, WorkboardTask] = {}
    for raw in tasks:
        columns, _, _, _ = split_canvas_payload(raw)
        canvas_id = columns["canvas_id"]
        if not canvas_id:
            continue
        result = await db.execute(select(WorkboardTask).where(WorkboardTask.canvas_id == canvas_id))
        existing = result.scalar_one_or_none()
        if existing is None:
            row = new_row_from_canvas(raw, parent_uuid=None)
            db.add(row)
            canvas_to_row[canvas_id] = row
            stats.created += 1
        else:
            columns, _, _, _ = split_canvas_payload(raw)
            resolved, preserved = resolve_persisted_status(
                existing.status,
                columns["status"],
            )
            if preserved:
                status_preserved += 1
            apply_canvas_payload_to_row(
                existing,
                raw,
                parent_uuid=None,
                status_override=resolved,
            )
            canvas_to_row[canvas_id] = existing
            stats.updated += 1

    await db.flush()

    # Second pass: wire parent_id from parent_canvas_id
    for raw in tasks:
        columns, _, _, _ = split_canvas_payload(raw)
        canvas_id = columns["canvas_id"]
        if not canvas_id or canvas_id not in canvas_to_row:
            continue
        row = canvas_to_row[canvas_id]
        parent_canvas = columns["parent_canvas_id"]
        if parent_canvas:
            parent_row = canvas_to_row.get(parent_canvas)
            if parent_row is None:
                parent_uuid = await _resolve_parent_id(db, parent_canvas)
            else:
                parent_uuid = parent_row.id
            row.parent_id = parent_uuid
            row.parent_canvas_id = parent_canvas
        else:
            row.parent_id = None
            row.parent_canvas_id = None

    if replace_missing and seen_canvas_ids:
        all_rows = await db.execute(select(WorkboardTask).where(WorkboardTask.deleted_at.is_(None)))
        for row in all_rows.scalars().all():
            if row.canvas_id not in seen_canvas_ids:
                row.deleted_at = _now()
                stats.soft_deleted += 1

    await db.commit()
    stats.status_preserved = status_preserved
    return stats


async def export_all_tasks(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(_task_query().order_by(WorkboardTask.number.asc()))
    return [row_to_canvas_dict(row) for row in result.scalars().all()]
