"""Unit tests for workspace layout normalization."""

from star_itsm_api.schemas.workspace_layout import (
    WorkspaceLandingLayout,
    WorkspaceWidgetInstance,
)
from star_itsm_api.services.workspace_layout_service import (
    DEFAULT_WORKSPACE_LAYOUT,
    layout_from_storage,
    normalize_layout,
)


def test_layout_from_storage_returns_defaults_for_empty() -> None:
    layout = layout_from_storage({})
    assert len(layout.personal) == len(DEFAULT_WORKSPACE_LAYOUT.personal)
    assert len(layout.team) == len(DEFAULT_WORKSPACE_LAYOUT.team)


def test_normalize_layout_reorders_visible_widgets() -> None:
    layout = WorkspaceLandingLayout(
        personal=[
            WorkspaceWidgetInstance(
                instance_id="b",
                kind="personal-notes",
                order=5,
                span="half",
            ),
            WorkspaceWidgetInstance(
                instance_id="a",
                kind="personal-dashboard",
                order=0,
                span="full",
            ),
        ],
        team=[],
    )
    normalized = normalize_layout(layout)
    assert normalized.personal[0].instance_id == "a"
    assert normalized.personal[0].order == 0
    assert normalized.personal[1].order == 1


def test_layout_from_storage_rejects_invalid_kind_payload() -> None:
    layout = layout_from_storage(
        {
            "personal": [{"instance_id": "x", "kind": "not-real", "order": 0}],
            "team": [],
        },
    )
    assert layout.personal[0].kind == "personal-dashboard"
