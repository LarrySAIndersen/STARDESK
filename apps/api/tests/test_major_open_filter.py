"""Store sager drill-down must use same open statuses as dashboard KPI."""

from star_itsm_api.services.reports import CLOSED_STATUSES, OPEN_STATUSES


def test_major_open_excludes_resolved_but_includes_active_open() -> None:
    assert "resolved" in CLOSED_STATUSES
    assert "resolved" not in OPEN_STATUSES
    assert "in_progress" in OPEN_STATUSES
    assert "closed" not in OPEN_STATUSES
