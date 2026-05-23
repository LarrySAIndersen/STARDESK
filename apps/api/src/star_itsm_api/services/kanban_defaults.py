"""Default Kanban columns aligned with ITSM status buckets."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from star_itsm_api.models.kanban import KanbanColumn
from star_itsm_api.services.reports import BUCKET_DEFINITIONS


def default_column_specs() -> list[tuple[str, int, list[str], str]]:
    """name, position, statuses, default_status."""
    specs: list[tuple[str, int, list[str], str]] = []
    for index, (_key, label, _desc, statuses) in enumerate(BUCKET_DEFINITIONS):
        status_list = sorted(statuses)
        specs.append((label, index, status_list, status_list[0]))
    return specs


def build_default_columns(board_id: uuid.UUID, now: datetime | None = None) -> list[KanbanColumn]:
    ts = now or datetime.now(UTC)
    columns: list[KanbanColumn] = []
    for name, position, statuses, default_status in default_column_specs():
        columns.append(
            KanbanColumn(
                id=uuid.uuid4(),
                board_id=board_id,
                name=name,
                position=position,
                statuses=statuses,
                default_status=default_status,
                is_custom=False,
                created_at=ts,
                updated_at=ts,
            )
        )
    return columns


def column_for_ticket_status(
    columns: list[KanbanColumn],
    status: str,
) -> KanbanColumn | None:
    for column in sorted(columns, key=lambda c: c.position):
        if status in column.statuses:
            return column
    return None


def all_board_statuses(columns: list[KanbanColumn]) -> frozenset[str]:
    result: set[str] = set()
    for column in columns:
        result.update(column.statuses)
    return frozenset(result)
