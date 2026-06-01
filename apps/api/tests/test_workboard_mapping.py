from star_itsm_api.models.workboard import WorkboardTask
from star_itsm_api.services.workboard_mapping import (
    apply_canvas_payload_to_row,
    new_row_from_canvas,
    row_to_canvas_dict,
    split_canvas_payload,
)


def test_split_canvas_payload_separates_columns_and_extra() -> None:
    raw = {
        "id": "canvas-1",
        "number": 7,
        "title": "Opgave",
        "status": "Backlog",
        "customField": "keep-me",
        "fieldHistory": {"title": []},
        "activityLog": [{"at": "now"}],
    }
    columns, extra, field_history, activity_log = split_canvas_payload(raw)

    assert columns["canvas_id"] == "canvas-1"
    assert columns["number"] == 7
    assert extra == {"customField": "keep-me"}
    assert field_history == {"title": []}
    assert activity_log == [{"at": "now"}]


def test_row_to_canvas_dict_includes_parent_and_logs() -> None:
    row = WorkboardTask()
    row.canvas_id = "c-1"
    row.number = 3
    row.title = "Fix bug"
    row.description = "Details"
    row.status = "Doing"
    row.priority = "P1"
    row.owner = "Jan"
    row.tags = "bug"
    row.source = "canvas"
    row.parent_canvas_id = "parent-1"
    row.field_history = {"status": []}
    row.activity_log = [{"msg": "created"}]
    row.extra = {"reviewer": "Anna"}

    payload = row_to_canvas_dict(row)

    assert payload["parentId"] == "parent-1"
    assert payload["fieldHistory"] == {"status": []}
    assert payload["reviewer"] == "Anna"


def test_new_row_from_canvas_defaults_status() -> None:
    row = new_row_from_canvas({"id": "abc", "number": 1, "title": "Ny"}, parent_uuid=None)

    assert row.canvas_id == "abc"
    assert row.number == 1
    assert row.status == "Backlog"


def test_apply_canvas_payload_to_row_respects_status_override() -> None:
    row = WorkboardTask()
    row.title = "Old"
    apply_canvas_payload_to_row(
        row,
        {"id": "x", "title": "New title", "status": "Backlog"},
        parent_uuid=None,
        status_override="Review",
    )

    assert row.title == "New title"
    assert row.status == "Review"
