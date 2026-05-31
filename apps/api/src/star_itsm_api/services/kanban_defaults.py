"""Default Kanban columns aligned with ITSM status buckets."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Literal

from star_itsm_api.models.kanban import KanbanColumn
from star_itsm_api.services.reports import BUCKET_DEFINITIONS

KanbanBoardTemplate = Literal["itsm", "simple", "delivery", "blank", "custom"]

SIMPLE_COLUMN_SPECS: list[tuple[str, int, list[str], str]] = [
    ("Backlog", 0, ["assigned", "new"], "new"),
    ("I gang", 1, ["in_progress", "on_hold"], "in_progress"),
    ("Færdig", 2, ["cancelled", "closed", "resolved"], "resolved"),
]

DELIVERY_COLUMN_SPECS: list[tuple[str, int, list[str], str]] = [
    ("Backlog", 0, ["new"], "new"),
    ("Refinement", 1, ["assigned"], "assigned"),
    ("Ready", 2, ["assigned"], "assigned"),
    ("In Progress", 3, ["in_progress"], "in_progress"),
    ("Review", 4, ["pending", "on_hold"], "pending"),
    ("Done", 5, ["resolved"], "resolved"),
    ("Archived", 6, ["closed", "cancelled"], "closed"),
]


def default_column_specs() -> list[tuple[str, int, list[str], str]]:
    """name, position, statuses, default_status."""
    specs: list[tuple[str, int, list[str], str]] = []
    for index, (_key, label, _desc, statuses) in enumerate(BUCKET_DEFINITIONS):
        status_list = sorted(statuses)
        specs.append((label, index, status_list, status_list[0]))
    return specs


def _column_specs_for_template(
    template: KanbanBoardTemplate,
    column_names: list[str] | None = None,
) -> list[tuple[str, int, list[str], str | None, bool]]:
    """name, position, statuses, default_status, is_custom."""
    if template == "blank":
        return []
    if template == "simple":
        return [
            (name, pos, statuses, default_status, False)
            for name, pos, statuses, default_status in SIMPLE_COLUMN_SPECS
        ]
    if template == "delivery":
        return [
            (name, pos, statuses, default_status, False)
            for name, pos, statuses, default_status in DELIVERY_COLUMN_SPECS
        ]
    if template == "custom":
        names = [name.strip() for name in (column_names or []) if name.strip()]
        if not names:
            raise ValueError("custom_template_requires_columns")
        return [(name, index, [], None, True) for index, name in enumerate(names)]
    return [
        (name, position, statuses, default_status, False)
        for name, position, statuses, default_status in default_column_specs()
    ]


def build_columns_for_board(
    board_id: uuid.UUID,
    template: KanbanBoardTemplate = "itsm",
    column_names: list[str] | None = None,
    now: datetime | None = None,
) -> list[KanbanColumn]:
    ts = now or datetime.now(UTC)
    columns: list[KanbanColumn] = []
    for name, position, statuses, default_status, is_custom in _column_specs_for_template(
        template, column_names
    ):
        columns.append(
            KanbanColumn(
                id=uuid.uuid4(),
                board_id=board_id,
                name=name,
                position=position,
                statuses=statuses,
                default_status=default_status,
                is_custom=is_custom,
                created_at=ts,
                updated_at=ts,
            )
        )
    return columns


def build_default_columns(board_id: uuid.UUID, now: datetime | None = None) -> list[KanbanColumn]:
    return build_columns_for_board(board_id, template="itsm", now=now)


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
