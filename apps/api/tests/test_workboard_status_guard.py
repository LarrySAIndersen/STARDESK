from star_itsm_api.services.workboard_status_guard import (
    column_index,
    is_allowed_staff_ui_status_change,
    is_allowed_workflow_status_change,
    resolve_persisted_status,
)


def test_column_index() -> None:
    assert column_index("Bobler") == 0
    assert column_index("Done") == 7
    assert column_index("InvalidStatus") is None


def test_is_allowed_workflow_status_change() -> None:
    # Same status
    assert is_allowed_workflow_status_change("Backlog", "Backlog") is True

    # Special transition
    assert is_allowed_workflow_status_change("Human Review", "In Progress") is True

    # Invalid status
    assert is_allowed_workflow_status_change("InvalidStatus", "Backlog") is False
    assert is_allowed_workflow_status_change("Backlog", "InvalidStatus") is False

    # Forward one column
    assert is_allowed_workflow_status_change("Bobler", "Backlog") is True
    assert is_allowed_workflow_status_change("Backlog", "Refinement") is True

    # Forward more than one column
    assert is_allowed_workflow_status_change("Bobler", "Refinement") is False

    # Backward transition (not special)
    assert is_allowed_workflow_status_change("Backlog", "Bobler") is False


def test_resolve_persisted_status() -> None:
    # No existing status
    assert resolve_persisted_status(None, "Backlog") == ("Backlog", False)

    # Same status
    assert resolve_persisted_status("Backlog", "Backlog") == ("Backlog", False)

    # Allowed change
    assert resolve_persisted_status("Bobler", "Backlog") == ("Backlog", False)

    # Disallowed change (should preserve existing)
    assert resolve_persisted_status("Backlog", "Bobler") == ("Backlog", True)


def test_is_allowed_staff_ui_status_change() -> None:
    assert is_allowed_staff_ui_status_change("Backlog", "In Progress") is True
    assert is_allowed_staff_ui_status_change("Refinement", "In Progress") is True
    assert is_allowed_staff_ui_status_change("In Progress", "Done") is True
    assert is_allowed_staff_ui_status_change("Done", "Backlog") is True
    assert is_allowed_staff_ui_status_change("Backlog", "Done") is False


def test_resolve_persisted_status_staff_ui() -> None:
    assert resolve_persisted_status("Backlog", "In Progress", staff_ui=True) == (
        "In Progress",
        False,
    )
    assert resolve_persisted_status("Backlog", "Done", staff_ui=True) == ("Backlog", True)
