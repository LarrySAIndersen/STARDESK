import uuid
from datetime import datetime, UTC
import pytest

from star_itsm_api.services.kanban_defaults import (
    default_column_specs,
    build_columns_for_board,
    build_default_columns,
    column_for_ticket_status,
    all_board_statuses,
)


def test_default_column_specs() -> None:
    specs = default_column_specs()
    assert len(specs) > 0
    for name, pos, statuses, default_status in specs:
        assert isinstance(name, str)
        assert isinstance(pos, int)
        assert isinstance(statuses, list)
        assert default_status in statuses


def test_build_columns_for_board_templates() -> None:
    board_id = uuid.uuid4()
    t0 = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)

    # 1. blank template
    cols_blank = build_columns_for_board(board_id, template="blank", now=t0)
    assert len(cols_blank) == 0

    # 2. simple template
    cols_simple = build_columns_for_board(board_id, template="simple", now=t0)
    assert len(cols_simple) == 3
    assert cols_simple[0].name == "Backlog"
    assert cols_simple[0].is_custom is False
    assert cols_simple[0].created_at == t0

    # 3. delivery template
    cols_delivery = build_columns_for_board(board_id, template="delivery", now=t0)
    assert len(cols_delivery) == 7
    assert cols_delivery[0].name == "Backlog"
    assert cols_delivery[1].name == "Refinement"

    # 4. custom template success
    cols_custom = build_columns_for_board(board_id, template="custom", column_names=["  Col A ", "Col B", ""], now=t0)
    assert len(cols_custom) == 2
    assert cols_custom[0].name == "Col A"
    assert cols_custom[0].is_custom is True

    # 5. custom template failure (no names)
    with pytest.raises(ValueError, match="custom_template_requires_columns"):
        build_columns_for_board(board_id, template="custom", column_names=[])

    # 6. itsm (default) template
    cols_itsm = build_columns_for_board(board_id, template="itsm", now=t0)
    assert len(cols_itsm) > 0


def test_build_default_columns() -> None:
    board_id = uuid.uuid4()
    cols = build_default_columns(board_id)
    assert len(cols) > 0


def test_column_for_ticket_status_and_all_board_statuses() -> None:
    board_id = uuid.uuid4()
    cols = build_columns_for_board(board_id, template="simple")
    
    # "assigned" is in position 0 ("Backlog")
    col = column_for_ticket_status(cols, "assigned")
    assert col is not None
    assert col.name == "Backlog"

    # "unknown_status" is not in any column
    assert column_for_ticket_status(cols, "unknown_status") is None

    # Check all board statuses
    statuses = all_board_statuses(cols)
    assert "assigned" in statuses
    assert "in_progress" in statuses
    assert "resolved" in statuses
