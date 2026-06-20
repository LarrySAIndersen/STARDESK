"""Guard Work Board status — only agent workflow may move columns in Neon.

Bulk-import and canvas sync must not regress tasks (e.g. Human Review → Review)
when stale UI cache is pushed after deploy.
"""

from __future__ import annotations

COLUMN_ORDER: tuple[str, ...] = (
    "Bobler",
    "Backlog",
    "Refinement",
    "Ready",
    "In Progress",
    "Review",
    "Human Review",
    "Done",
    "Archived",
)

# Explicit transitions that are not a single +1 step but are allowed in agent flow.
SPECIAL_ALLOWED_TRANSITIONS: frozenset[tuple[str, str]] = frozenset(
    {
        ("Human Review", "In Progress"),  # Human Review reject → rerun
    }
)

# Simplified web backlog (/workboard) — staff may jump between these groups.
LATER_STATUSES: frozenset[str] = frozenset({"Bobler", "Backlog", "Refinement", "Ready"})
ACTIVE_STATUSES: frozenset[str] = frozenset({"In Progress", "Review", "Human Review"})
DONE_STATUSES: frozenset[str] = frozenset({"Done", "Archived"})


def column_index(status: str) -> int | None:
    try:
        return COLUMN_ORDER.index(status)
    except ValueError:
        return None


def is_allowed_workflow_status_change(from_status: str, to_status: str) -> bool:
    """True when incoming status may replace existing DB/canvas status."""
    if from_status == to_status:
        return True
    if (from_status, to_status) in SPECIAL_ALLOWED_TRANSITIONS:
        return True
    from_i = column_index(from_status)
    to_i = column_index(to_status)
    if from_i is None or to_i is None:
        return False
    # Forward one column only (agent pipeline / auto-archive).
    return to_i == from_i + 1


def is_allowed_staff_ui_status_change(from_status: str, to_status: str) -> bool:
    """Staff web backlog — jump between later / active / done groups."""
    if from_status == to_status:
        return True
    if to_status == "In Progress" and from_status in LATER_STATUSES:
        return True
    if to_status == "Done" and from_status in ACTIVE_STATUSES:
        return True
    if to_status == "Backlog" and from_status in ACTIVE_STATUSES | DONE_STATUSES:
        return True
    return is_allowed_workflow_status_change(from_status, to_status)


def resolve_persisted_status(
    existing_status: str | None,
    incoming_status: str,
    *,
    staff_ui: bool = False,
) -> tuple[str, bool]:
    """Return (status_to_write, status_was_preserved).

    New tasks (no existing row) always accept incoming status.
    staff_ui=True for PATCH from /workboard web UI (not canvas bulk-import).
    """
    if existing_status is None:
        return incoming_status, False
    if existing_status == incoming_status:
        return incoming_status, False
    allowed = (
        is_allowed_staff_ui_status_change(existing_status, incoming_status)
        if staff_ui
        else is_allowed_workflow_status_change(existing_status, incoming_status)
    )
    if allowed:
        return incoming_status, False
    return existing_status, True
