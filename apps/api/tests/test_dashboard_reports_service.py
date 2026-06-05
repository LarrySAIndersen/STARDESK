import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.schemas.report import ReportBucket, ReportTicketRow, StandardReportRead
from star_itsm_api.services import dashboard as dashboard_service
from star_itsm_api.services import reports as reports_service
from star_itsm_api.services.dashboard_scope import DashboardScope


def test_status_label_da_known_status() -> None:
    assert reports_service.status_label_da("in_progress") == "I gang"


def test_is_reopen_transition_detects_closed_to_open() -> None:
    assert reports_service.is_reopen_transition("closed", "new") is True
    assert reports_service.is_reopen_transition("new", "closed") is False


def test_to_report_row_maps_fields() -> None:
    ticket = SimpleNamespace(
        id=uuid.uuid4(),
        ticket_number="INC-2026-00001",
        title="Printer",
        status="new",
        priority="high",
        ticket_type="incident",
        organization_id=None,
        created_at=datetime(2026, 6, 1, tzinfo=UTC),
        updated_at=None,
        resolved_at=None,
        closed_at=None,
    )
    row = reports_service._to_report_row(ticket)
    assert row.ticket_number == "INC-2026-00001"
    assert row.status_label_da == "Ny"


def test_report_to_csv_includes_bucket_header() -> None:
    report = StandardReportRead(
        generated_at=datetime(2026, 6, 1, tzinfo=UTC),
        period_days=30,
        total_tickets=1,
        buckets=[
            ReportBucket(
                key="modtaget",
                label_da="Modtaget",
                description_da="Test",
                count=1,
                tickets=[
                    ReportTicketRow(
                        id=uuid.uuid4(),
                        ticket_number="INC-1",
                        title="T",
                        status="new",
                        status_label_da="Ny",
                        priority="medium",
                        ticket_type="incident",
                        assigned_team_name=None,
                        assigned_user_name=None,
                        organization_id=None,
                        created_at=datetime(2026, 6, 1, tzinfo=UTC),
                        updated_at=None,
                        resolved_at=None,
                        closed_at=None,
                        reopened_at=None,
                    )
                ],
            )
        ],
    )
    csv_text = reports_service.report_to_csv(report, bucket_key="modtaget")
    assert "STARdesk standardrapport" in csv_text
    assert "Modtaget" in csv_text
    assert "INC-1" in csv_text


@pytest.mark.asyncio
async def test_reopened_ticket_ids_from_reopen_event() -> None:
    ticket_id = uuid.uuid4()
    reopened_at = datetime(2026, 6, 1, 10, 0, tzinfo=UTC)
    event = TicketEvent()
    event.ticket_id = ticket_id
    event.event_type = "ticket.reopened"
    event.created_at = reopened_at
    event.payload = {}

    result = MagicMock()
    result.scalars.return_value.all.return_value = [event]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=result)

    mapping = await reports_service._reopened_ticket_ids(
        mock_db, ticket_ids=[ticket_id], since=None
    )
    assert mapping[ticket_id] == reopened_at


def _ticket(**kwargs: object) -> SimpleNamespace:
    now = datetime.now(UTC)
    defaults: dict[str, object] = {
        "id": uuid.uuid4(),
        "status": "new",
        "priority": "medium",
        "created_at": now - timedelta(days=2),
        "is_major": False,
        "closed_at": None,
        "resolved_at": None,
        "updated_at": None,
        "resolution_due_at": None,
        "response_due_at": None,
        "ticket_number": "INC-1",
        "title": "Test sag",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


@pytest.mark.asyncio
async def test_build_dashboard_counts_open_and_closed() -> None:
    now = datetime.now(UTC)
    open_ticket = _ticket(status="in_progress", created_at=now - timedelta(days=3))
    closed_ticket = _ticket(
        status="closed",
        created_at=now - timedelta(days=10),
        closed_at=now - timedelta(days=1),
    )

    tickets_result = MagicMock()
    tickets_result.scalars.return_value.all.return_value = [open_ticket, closed_ticket]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=tickets_result)

    admin = SimpleNamespace(id=uuid.uuid4(), role="admin", organization_id=None)

    with (
        patch(
            "star_itsm_api.services.dashboard._ticket_scope_stmt",
            AsyncMock(return_value=MagicMock()),
        ),
        patch(
            "star_itsm_api.services.dashboard.get_user_team_ids",
            AsyncMock(return_value=[]),
        ),
        patch(
            "star_itsm_api.services.dashboard.tickets_to_read_list",
            AsyncMock(return_value=[]),
        ),
    ):
        dashboard = await dashboard_service.build_dashboard(
            mock_db,
            admin,
            scope=DashboardScope.all,
        )

    assert dashboard.open_count == 1
    assert dashboard.closed_count == 1
    assert dashboard.opened_last_7_days >= 1
    assert len(dashboard.daily_created) == 14


@pytest.mark.asyncio
async def test_build_dashboard_with_scope_filtering() -> None:
    now = datetime.now(UTC)
    ticket1 = _ticket(status="new", is_major=True, resolution_due_at=now - timedelta(hours=1))
    ticket2 = _ticket(status="closed", is_major=False)
    
    tickets_result = MagicMock()
    tickets_result.scalars.return_value.all.return_value = [ticket1, ticket2]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=tickets_result)
    
    user = SimpleNamespace(id=uuid.uuid4(), role="agent", organization_id=None)
    
    # Test scope filtering, major open count, and SLA overdue count
    with (
        patch(
            "star_itsm_api.services.dashboard._ticket_scope_stmt",
            AsyncMock(return_value=MagicMock()),
        ),
        patch(
            "star_itsm_api.services.dashboard.get_user_team_ids",
            AsyncMock(return_value=[uuid.uuid4()]),
        ) as mock_get_teams,
        patch(
            "star_itsm_api.services.dashboard.filter_tickets_by_scope",
            return_value=[ticket1],  # Filtered down to just ticket1
        ) as mock_filter,
        patch(
            "star_itsm_api.services.dashboard.tickets_to_read_list",
            AsyncMock(return_value=[SimpleNamespace(
                assigned_team_name="Team A",
                assigned_user_name="User A",
                resolution_due_at=now - timedelta(hours=1),
                sla_remaining_seconds=-3600,
                sla_breached=True,
            )]),
        ),
    ):
        dashboard = await dashboard_service.build_dashboard(
            mock_db,
            user,
            scope=DashboardScope.mine,
        )
        
    assert dashboard.open_count == 1
    assert dashboard.major_open_count == 1
    assert dashboard.sla_overdue_count == 1
    mock_get_teams.assert_called_once()
    mock_filter.assert_called_once()


@pytest.mark.asyncio
async def test_build_dashboard_tickets_to_read_list_exception() -> None:
    now = datetime.now(UTC)
    ticket = _ticket(status="new")
    
    tickets_result = MagicMock()
    tickets_result.scalars.return_value.all.return_value = [ticket]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=tickets_result)
    
    user = SimpleNamespace(id=uuid.uuid4(), role="agent", organization_id=None)
    
    with (
        patch(
            "star_itsm_api.services.dashboard._ticket_scope_stmt",
            AsyncMock(return_value=MagicMock()),
        ),
        patch(
            "star_itsm_api.services.dashboard.get_user_team_ids",
            AsyncMock(return_value=[]),
        ),
        patch(
            "star_itsm_api.services.dashboard.tickets_to_read_list",
            AsyncMock(side_effect=Exception("DB Error")),
        ),
    ):
        dashboard = await dashboard_service.build_dashboard(
            mock_db,
            user,
            scope=DashboardScope.all,
        )
        
    assert dashboard.open_count == 1
    assert dashboard.longest_open is not None
    assert dashboard.longest_open.assigned_team_name is None
    assert dashboard.longest_open.assigned_user_name is None

