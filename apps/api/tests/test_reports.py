import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.services import reports as reports_service


async def test_standard_report_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/standard")
    assert response.status_code == 503


async def test_dashboard_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/dashboard")
    assert response.status_code == 503


async def test_dashboard_invalid_scope_returns_400(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/dashboard?scope=invalid")
    assert response.status_code in (400, 503)


async def test_custom_report_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/custom")
    assert response.status_code == 503


async def test_custom_report_export_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/custom/export")
    assert response.status_code == 503


async def test_predefined_reports_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/predefined")
    assert response.status_code == 503


# --- Pure helpers ---------------------------------------------------------


def test_status_label_da_known_and_unknown() -> None:
    assert reports_service.status_label_da("in_progress") == "I gang"
    assert reports_service.status_label_da("resolved") == "Løst"
    assert reports_service.status_label_da("unknown_status") == "unknown_status"


def test_is_reopen_transition() -> None:
    assert reports_service.is_reopen_transition("closed", "new") is True
    assert reports_service.is_reopen_transition("resolved", "in_progress") is True
    assert reports_service.is_reopen_transition("new", "closed") is False
    assert reports_service.is_reopen_transition("new", "assigned") is False


def test_ticket_scope_stmt_full_visibility() -> None:
    user = SimpleNamespace(role="admin", organization_id=None)
    with (
        patch.object(reports_service, "has_full_ticket_visibility", return_value=True),
        patch.object(reports_service, "get_user_organization_id", return_value=None),
    ):
        stmt = reports_service._ticket_scope_stmt(user)
    assert stmt is not None


def test_ticket_scope_stmt_org_scoped() -> None:
    org_id = uuid.uuid4()
    user = SimpleNamespace(role="submitter", organization_id=org_id)
    with (
        patch.object(reports_service, "has_full_ticket_visibility", return_value=False),
        patch.object(reports_service, "get_user_organization_id", return_value=org_id),
    ):
        stmt = reports_service._ticket_scope_stmt(user)
    assert stmt is not None


# --- _reopened_ticket_ids -------------------------------------------------


@pytest.mark.asyncio
async def test_reopened_ticket_ids_empty_returns_empty() -> None:
    db = AsyncMock()
    result = await reports_service._reopened_ticket_ids(db, ticket_ids=[], since=None)
    assert result == {}
    db.execute.assert_not_called()


def _event(*, ticket_id: uuid.UUID, event_type: str, created_at: datetime, payload: dict | None) -> TicketEvent:
    event = TicketEvent()
    event.ticket_id = ticket_id
    event.event_type = event_type
    event.created_at = created_at
    event.payload = payload
    return event


@pytest.mark.asyncio
async def test_reopened_ticket_ids_since_none_skips_filter() -> None:
    t_id = uuid.uuid4()
    base = datetime(2026, 6, 1, 10, 0, tzinfo=UTC)
    events = [
        _event(ticket_id=t_id, event_type="ticket.reopened", created_at=base, payload={}),
    ]
    execute_result = MagicMock()
    execute_result.scalars.return_value.all.return_value = events
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    mapping = await reports_service._reopened_ticket_ids(db, ticket_ids=[t_id], since=None)
    assert mapping[t_id] == base


@pytest.mark.asyncio
async def test_reopened_ticket_ids_various_events() -> None:
    t_reopen = uuid.uuid4()
    t_status = uuid.uuid4()
    t_noise = uuid.uuid4()
    base = datetime(2026, 6, 1, 10, 0, tzinfo=UTC)

    events = [
        _event(ticket_id=t_reopen, event_type="ticket.reopened", created_at=base, payload=None),
        # Duplicate reopened event should not override the first.
        _event(
            ticket_id=t_reopen,
            event_type="ticket.reopened",
            created_at=base + timedelta(hours=1),
            payload={},
        ),
        # status_changed that is a reopen transition.
        _event(
            ticket_id=t_status,
            event_type="ticket.status_changed",
            created_at=base + timedelta(hours=2),
            payload={"previous_status": "closed", "status": "in_progress"},
        ),
        # status_changed that is NOT a reopen transition.
        _event(
            ticket_id=t_noise,
            event_type="ticket.status_changed",
            created_at=base,
            payload={"previous_status": "new", "status": "assigned"},
        ),
        # status_changed with non-string payload values -> ignored.
        _event(
            ticket_id=t_noise,
            event_type="ticket.status_changed",
            created_at=base,
            payload={"previous_status": None, "status": 5},
        ),
    ]

    execute_result = MagicMock()
    execute_result.scalars.return_value.all.return_value = events
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    mapping = await reports_service._reopened_ticket_ids(
        db,
        ticket_ids=[t_reopen, t_status, t_noise],
        since=base - timedelta(days=1),
    )

    assert mapping[t_reopen] == base
    assert mapping[t_status] == base + timedelta(hours=2)
    assert t_noise not in mapping


# --- build_standard_report ------------------------------------------------


async def _fake_read_list(db: object, tickets: list) -> list:
    return [
        SimpleNamespace(
            id=t.id,
            assigned_team_name="Servicedesk",
            assigned_user_name="Anna Agent",
        )
        for t in tickets
    ]


def _report_ticket(*, status: str, **kwargs: object) -> SimpleNamespace:
    now = datetime(2026, 6, 1, 9, 0, tzinfo=UTC)
    defaults: dict[str, object] = {
        "id": uuid.uuid4(),
        "ticket_number": "INC-1",
        "title": "Sag",
        "status": status,
        "priority": "medium",
        "ticket_type": "incident",
        "organization_id": None,
        "created_at": now,
        "updated_at": now,
        "resolved_at": None,
        "closed_at": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


@pytest.mark.asyncio
async def test_build_standard_report_enriched() -> None:
    new_ticket = _report_ticket(status="new")
    progress_ticket = _report_ticket(status="in_progress")
    resolved_ticket = _report_ticket(status="resolved")
    closed_ticket = _report_ticket(status="closed")
    tickets = [new_ticket, progress_ticket, resolved_ticket, closed_ticket]

    tickets_result = MagicMock()
    tickets_result.scalars.return_value.all.return_value = tickets
    db = AsyncMock()
    db.execute = AsyncMock(return_value=tickets_result)

    reopened_dt = datetime(2026, 6, 2, 8, 0, tzinfo=UTC)
    reopened_map = {closed_ticket.id: reopened_dt, resolved_ticket.id: None}

    with (
        patch.object(reports_service, "_ticket_scope_stmt", return_value=MagicMock()),
        patch.object(
            reports_service,
            "_reopened_ticket_ids",
            AsyncMock(return_value=reopened_map),
        ),
        patch.object(
            reports_service,
            "tickets_to_read_list",
            AsyncMock(side_effect=_fake_read_list),
        ),
    ):
        report = await reports_service.build_standard_report(db, MagicMock(), period_days=30)

    assert report.total_tickets == 4
    assert report.period_days == 30
    bucket_by_key = {b.key: b for b in report.buckets}
    assert bucket_by_key["modtaget"].count == 1
    assert bucket_by_key["igangsat"].count == 1
    assert bucket_by_key["lost"].count == 1
    assert bucket_by_key["lukket"].count == 1
    # Only the closed ticket has a real reopened_at; resolved ticket had None -> skipped.
    assert bucket_by_key["genaabnet"].count == 1
    assert bucket_by_key["genaabnet"].tickets[0].reopened_at == reopened_dt
    # Enriched fields propagated.
    assert bucket_by_key["modtaget"].tickets[0].assigned_user_name == "Anna Agent"


@pytest.mark.asyncio
async def test_build_standard_report_reopen_without_enrichment() -> None:
    # A reopened ticket whose enrichment lookup returns nothing -> covers the
    # branch where the reopen row is appended without model_copy.
    closed_ticket = _report_ticket(status="closed")
    tickets = [closed_ticket]

    tickets_result = MagicMock()
    tickets_result.scalars.return_value.all.return_value = tickets
    db = AsyncMock()
    db.execute = AsyncMock(return_value=tickets_result)

    reopened_dt = datetime(2026, 6, 2, 8, 0, tzinfo=UTC)

    with (
        patch.object(reports_service, "_ticket_scope_stmt", return_value=MagicMock()),
        patch.object(
            reports_service,
            "_reopened_ticket_ids",
            AsyncMock(return_value={closed_ticket.id: reopened_dt}),
        ),
        patch.object(
            reports_service,
            "tickets_to_read_list",
            AsyncMock(return_value=[]),
        ),
    ):
        report = await reports_service.build_standard_report(db, MagicMock(), period_days=0)

    bucket_by_key = {b.key: b for b in report.buckets}
    assert bucket_by_key["genaabnet"].count == 1
    assert bucket_by_key["genaabnet"].tickets[0].assigned_user_name is None


@pytest.mark.asyncio
async def test_build_standard_report_minimal_no_enrichment() -> None:
    new_ticket = _report_ticket(status="new")
    tickets = [new_ticket]

    tickets_result = MagicMock()
    tickets_result.scalars.return_value.all.return_value = tickets
    db = AsyncMock()
    db.execute = AsyncMock(return_value=tickets_result)

    with (
        patch.object(reports_service, "_ticket_scope_stmt", return_value=MagicMock()),
        patch.object(
            reports_service,
            "_reopened_ticket_ids",
            AsyncMock(return_value={}),
        ),
        patch.object(
            reports_service,
            "tickets_to_read_list",
            AsyncMock(return_value=[]),
        ),
    ):
        report = await reports_service.build_standard_report(db, MagicMock(), period_days=None)

    assert report.period_days is None
    assert report.total_tickets == 1
    bucket_by_key = {b.key: b for b in report.buckets}
    assert bucket_by_key["genaabnet"].count == 0
    # No enrichment -> names stay None.
    assert bucket_by_key["modtaget"].tickets[0].assigned_user_name is None


# --- report_to_csv --------------------------------------------------------


@pytest.mark.asyncio
async def test_report_to_csv_all_buckets_and_filter() -> None:
    new_ticket = _report_ticket(status="new", resolved_at=None, closed_at=None)
    closed_ticket = _report_ticket(
        status="closed",
        ticket_number="INC-2",
        resolved_at=datetime(2026, 6, 3, tzinfo=UTC),
        closed_at=datetime(2026, 6, 4, tzinfo=UTC),
    )

    tickets_result = MagicMock()
    tickets_result.scalars.return_value.all.return_value = [new_ticket, closed_ticket]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=tickets_result)

    reopened_map = {closed_ticket.id: datetime(2026, 6, 5, tzinfo=UTC)}

    with (
        patch.object(reports_service, "_ticket_scope_stmt", return_value=MagicMock()),
        patch.object(
            reports_service,
            "_reopened_ticket_ids",
            AsyncMock(return_value=reopened_map),
        ),
        patch.object(
            reports_service,
            "tickets_to_read_list",
            AsyncMock(side_effect=_fake_read_list),
        ),
    ):
        report = await reports_service.build_standard_report(db, MagicMock(), period_days=30)

    # Full CSV (all buckets, with period row).
    csv_all = reports_service.report_to_csv(report)
    assert "STARdesk standardrapport" in csv_all
    assert "Periode (dage)" in csv_all
    assert "INC-2" in csv_all
    assert "Genåbnet" in csv_all

    # Filtered to a single bucket.
    csv_filtered = reports_service.report_to_csv(report, bucket_key="modtaget")
    assert "INC-1" in csv_filtered
    assert "INC-2" not in csv_filtered


def test_report_to_csv_without_period() -> None:
    from star_itsm_api.schemas.report import ReportBucket, ReportTicketRow, StandardReportRead

    row = ReportTicketRow(
        id=uuid.uuid4(),
        ticket_number="INC-9",
        title="T",
        status="closed",
        status_label_da="Lukket",
        priority="low",
        ticket_type="incident",
        assigned_team_name=None,
        assigned_user_name=None,
        organization_id=None,
        created_at=datetime(2026, 6, 1, tzinfo=UTC),
        updated_at=None,
        resolved_at=datetime(2026, 6, 2, tzinfo=UTC),
        closed_at=datetime(2026, 6, 3, tzinfo=UTC),
        reopened_at=datetime(2026, 6, 4, tzinfo=UTC),
    )
    report = StandardReportRead(
        generated_at=datetime(2026, 6, 1, tzinfo=UTC),
        period_days=None,
        total_tickets=1,
        buckets=[
            ReportBucket(
                key="lukket",
                label_da="Lukket",
                description_da="Afsluttede",
                count=1,
                tickets=[row],
            )
        ],
    )
    csv_text = reports_service.report_to_csv(report)
    assert "Periode (dage)" not in csv_text
    assert "INC-9" in csv_text
