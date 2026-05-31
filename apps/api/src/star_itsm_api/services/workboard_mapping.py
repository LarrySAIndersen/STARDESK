"""Map between canvas JSON tasks and workboard_tasks rows."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from star_itsm_api.models.workboard import WorkboardTask

_COLUMN_KEYS = frozenset(
    {
        "id",
        "number",
        "title",
        "description",
        "status",
        "priority",
        "owner",
        "tags",
        "source",
        "parentId",
        "parent_id",
        "fieldHistory",
        "activityLog",
        "field_history",
        "activity_log",
    }
)


def _now() -> datetime:
    return datetime.now(UTC)


def split_canvas_payload(
    raw: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], list[Any]]:
    """Return column fields, extra JSON, field_history, activity_log."""
    field_history = raw.get("fieldHistory") or raw.get("field_history") or {}
    activity_log = raw.get("activityLog") or raw.get("activity_log") or []
    if not isinstance(field_history, dict):
        field_history = {}
    if not isinstance(activity_log, list):
        activity_log = []

    columns: dict[str, Any] = {
        "canvas_id": str(raw.get("id") or "").strip(),
        "number": raw.get("number"),
        "title": str(raw.get("title") or "").strip(),
        "description": str(raw.get("description") or ""),
        "status": str(raw.get("status") or "Backlog"),
        "priority": str(raw.get("priority") or "P2"),
        "owner": str(raw.get("owner") or ""),
        "tags": str(raw.get("tags") or ""),
        "source": str(raw.get("source") or ""),
        "parent_canvas_id": raw.get("parentId") or raw.get("parent_id"),
    }
    extra = {
        key: value for key, value in raw.items() if key not in _COLUMN_KEYS and value is not None
    }
    return columns, extra, field_history, activity_log


def row_to_canvas_dict(row: WorkboardTask) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": row.canvas_id,
        "number": row.number,
        "title": row.title,
        "description": row.description,
        "status": row.status,
        "priority": row.priority,
        "owner": row.owner,
        "tags": row.tags,
        "source": row.source,
    }
    if row.parent_canvas_id:
        payload["parentId"] = row.parent_canvas_id
    if row.field_history:
        payload["fieldHistory"] = row.field_history
    if row.activity_log:
        payload["activityLog"] = row.activity_log
    if row.extra:
        payload.update(row.extra)
    return payload


def apply_canvas_payload_to_row(
    row: WorkboardTask,
    raw: dict[str, Any],
    *,
    parent_uuid: uuid.UUID | None,
    status_override: str | None = None,
) -> None:
    columns, extra, field_history, activity_log = split_canvas_payload(raw)
    if columns["canvas_id"]:
        row.canvas_id = columns["canvas_id"]
    if columns["number"] is not None:
        row.number = int(columns["number"])
    row.title = columns["title"] or row.title
    row.description = columns["description"]
    row.status = status_override if status_override is not None else columns["status"]
    row.priority = columns["priority"]
    row.owner = columns["owner"]
    row.tags = columns["tags"]
    row.source = columns["source"]
    row.parent_canvas_id = columns["parent_canvas_id"]
    row.parent_id = parent_uuid
    row.extra = extra
    row.field_history = field_history
    row.activity_log = activity_log
    row.updated_at = _now()


def new_row_from_canvas(raw: dict[str, Any], *, parent_uuid: uuid.UUID | None) -> WorkboardTask:
    columns, extra, field_history, activity_log = split_canvas_payload(raw)
    canvas_id = columns["canvas_id"] or f"t-{columns['number']}"
    now = _now()
    return WorkboardTask(
        id=uuid.uuid4(),
        canvas_id=canvas_id,
        number=int(columns["number"] or 0),
        title=columns["title"] or "(untitled)",
        description=columns["description"],
        status=columns["status"],
        priority=columns["priority"],
        owner=columns["owner"],
        tags=columns["tags"],
        source=columns["source"],
        parent_id=parent_uuid,
        parent_canvas_id=columns["parent_canvas_id"],
        extra=extra,
        field_history=field_history,
        activity_log=activity_log,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
