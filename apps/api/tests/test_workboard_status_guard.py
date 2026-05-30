import pytest

from star_itsm_api.services.workboard_status_guard import (
    is_allowed_workflow_status_change,
    resolve_persisted_status,
)


@pytest.mark.parametrize(
    ("from_status", "to_status", "allowed"),
    [
        ("In Progress", "Review", True),
        ("Review", "Human Review", True),
        ("Human Review", "Done", True),
        ("Done", "Archived", True),
        ("Human Review", "In Progress", True),
        ("Human Review", "Review", False),
        ("Review", "Backlog", False),
        ("Done", "In Progress", False),
        ("Ready", "Review", False),
    ],
)
def test_workflow_status_change_rules(
    from_status: str,
    to_status: str,
    allowed: bool,
) -> None:
    assert is_allowed_workflow_status_change(from_status, to_status) is allowed


def test_resolve_persisted_status_blocks_regression() -> None:
    resolved, preserved = resolve_persisted_status("Human Review", "Review")
    assert preserved is True
    assert resolved == "Human Review"


def test_resolve_persisted_status_allows_forward() -> None:
    resolved, preserved = resolve_persisted_status("In Progress", "Review")
    assert preserved is False
    assert resolved == "Review"


def test_resolve_persisted_status_new_task() -> None:
    resolved, preserved = resolve_persisted_status(None, "Backlog")
    assert preserved is False
    assert resolved == "Backlog"
