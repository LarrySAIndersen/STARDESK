"""Unit tests for star_itsm_api.services.dashboard_scope."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services import dashboard_scope
from star_itsm_api.services.dashboard_scope import (
    DashboardScope,
    default_dashboard_scope,
    filter_tickets_by_scope,
    parse_dashboard_scope,
    ticket_in_scope,
)


def _ticket(
    *,
    assigned_user_id: uuid.UUID | None = None,
    assigned_team_id: uuid.UUID | None = None,
    reporter_user_id: uuid.UUID | None = None,
) -> Ticket:
    ticket = Ticket()
    ticket.assigned_user_id = assigned_user_id
    ticket.assigned_team_id = assigned_team_id
    ticket.reporter_user_id = reporter_user_id or uuid.uuid4()
    return ticket


@pytest.mark.parametrize(
    "value,expected",
    [
        (None, None),
        ("", None),
        ("mine", DashboardScope.mine),
        ("group", DashboardScope.group),
        ("nonsense", None),
    ],
)
def test_parse_dashboard_scope(value: str | None, expected: DashboardScope | None) -> None:
    assert parse_dashboard_scope(value) == expected


def test_default_dashboard_scope_admin() -> None:
    user = SimpleNamespace(id=uuid.uuid4(), role="admin")
    assert default_dashboard_scope(user) == DashboardScope.all  # type: ignore[arg-type]


def test_default_dashboard_scope_agent() -> None:
    user = SimpleNamespace(id=uuid.uuid4(), role="agent")
    assert default_dashboard_scope(user) == DashboardScope.personal  # type: ignore[arg-type]


def test_ticket_in_scope_all_returns_true() -> None:
    assert ticket_in_scope(
        _ticket(),
        user_id=uuid.uuid4(),
        team_ids=[],
        scope=DashboardScope.all,
    )


def test_ticket_in_scope_mine_branches() -> None:
    uid = uuid.uuid4()
    assert ticket_in_scope(
        _ticket(assigned_user_id=uid), user_id=uid, team_ids=[], scope=DashboardScope.mine
    )
    assert not ticket_in_scope(
        _ticket(), user_id=uid, team_ids=[], scope=DashboardScope.mine
    )


def test_ticket_in_scope_group_branches() -> None:
    uid = uuid.uuid4()
    team = uuid.uuid4()
    assert ticket_in_scope(
        _ticket(assigned_team_id=team),
        user_id=uid,
        team_ids=[team],
        scope=DashboardScope.group,
    )
    assert not ticket_in_scope(
        _ticket(assigned_team_id=uuid.uuid4()),
        user_id=uid,
        team_ids=[team],
        scope=DashboardScope.group,
    )


def test_ticket_in_scope_created_branch() -> None:
    uid = uuid.uuid4()
    assert ticket_in_scope(
        _ticket(reporter_user_id=uid),
        user_id=uid,
        team_ids=[],
        scope=DashboardScope.created,
    )


def test_ticket_in_scope_personal_union() -> None:
    uid = uuid.uuid4()
    assert ticket_in_scope(
        _ticket(reporter_user_id=uid),
        user_id=uid,
        team_ids=[],
        scope=DashboardScope.personal,
    )
    assert not ticket_in_scope(
        _ticket(),
        user_id=uid,
        team_ids=[],
        scope=DashboardScope.personal,
    )


def test_filter_tickets_by_scope_all_returns_all() -> None:
    tickets = [_ticket(), _ticket()]
    out = filter_tickets_by_scope(
        tickets,
        user=SimpleNamespace(id=uuid.uuid4()),  # type: ignore[arg-type]
        team_ids=[],
        scope=DashboardScope.all,
    )
    assert out == tickets


def test_filter_tickets_by_scope_filters() -> None:
    uid = uuid.uuid4()
    mine = _ticket(assigned_user_id=uid)
    other = _ticket()
    out = filter_tickets_by_scope(
        [mine, other],
        user=SimpleNamespace(id=uid),  # type: ignore[arg-type]
        team_ids=[],
        scope=DashboardScope.mine,
    )
    assert out == [mine]


@pytest.mark.asyncio
async def test_apply_scope_all_returns_stmt_unchanged() -> None:
    db = AsyncMock()
    stmt = MagicMock()
    user = SimpleNamespace(id=uuid.uuid4())
    out = await dashboard_scope.apply_dashboard_scope_stmt(
        db, stmt, user, DashboardScope.all  # type: ignore[arg-type]
    )
    assert out is stmt


@pytest.mark.asyncio
async def test_apply_scope_mine() -> None:
    db = AsyncMock()
    stmt = MagicMock()
    stmt.where.return_value = "WHERE_MINE"
    user = SimpleNamespace(id=uuid.uuid4())
    with patch.object(dashboard_scope, "get_user_team_ids", new=AsyncMock(return_value=[])):
        out = await dashboard_scope.apply_dashboard_scope_stmt(
            db, stmt, user, DashboardScope.mine  # type: ignore[arg-type]
        )
    assert out == "WHERE_MINE"


@pytest.mark.asyncio
async def test_apply_scope_group_with_team_ids() -> None:
    db = AsyncMock()
    stmt = MagicMock()
    stmt.where.return_value = "WHERE_GROUP"
    user = SimpleNamespace(id=uuid.uuid4())
    with patch.object(
        dashboard_scope, "get_user_team_ids", new=AsyncMock(return_value=[uuid.uuid4()])
    ):
        out = await dashboard_scope.apply_dashboard_scope_stmt(
            db, stmt, user, DashboardScope.group  # type: ignore[arg-type]
        )
    assert out == "WHERE_GROUP"


@pytest.mark.asyncio
async def test_apply_scope_group_without_team_ids() -> None:
    db = AsyncMock()
    stmt = MagicMock()
    stmt.where.return_value = "WHERE_NONE"
    user = SimpleNamespace(id=uuid.uuid4())
    with patch.object(dashboard_scope, "get_user_team_ids", new=AsyncMock(return_value=[])):
        out = await dashboard_scope.apply_dashboard_scope_stmt(
            db, stmt, user, DashboardScope.group  # type: ignore[arg-type]
        )
    assert out == "WHERE_NONE"


@pytest.mark.asyncio
async def test_apply_scope_created() -> None:
    db = AsyncMock()
    stmt = MagicMock()
    stmt.where.return_value = "WHERE_CREATED"
    user = SimpleNamespace(id=uuid.uuid4())
    with patch.object(dashboard_scope, "get_user_team_ids", new=AsyncMock(return_value=[])):
        out = await dashboard_scope.apply_dashboard_scope_stmt(
            db, stmt, user, DashboardScope.created  # type: ignore[arg-type]
        )
    assert out == "WHERE_CREATED"


@pytest.mark.asyncio
async def test_apply_scope_personal_union_with_team_ids() -> None:
    db = AsyncMock()
    stmt = MagicMock()
    stmt.where.return_value = "WHERE_UNION"
    user = SimpleNamespace(id=uuid.uuid4())
    with patch.object(
        dashboard_scope, "get_user_team_ids", new=AsyncMock(return_value=[uuid.uuid4()])
    ):
        out = await dashboard_scope.apply_dashboard_scope_stmt(
            db, stmt, user, DashboardScope.personal  # type: ignore[arg-type]
        )
    assert out == "WHERE_UNION"
