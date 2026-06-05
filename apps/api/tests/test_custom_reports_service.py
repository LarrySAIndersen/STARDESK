import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.services import custom_reports as cr


def _ticket(**kwargs: object) -> SimpleNamespace:
    now = datetime.now(UTC)
    defaults: dict[str, object] = {
        "id": uuid.uuid4(),
        "ticket_number": "INC-2026-00001",
        "title": "Test sag",
        "status": "new",
        "priority": "medium",
        "ticket_type": "incident",
        "organization_id": None,
        "created_at": now - timedelta(days=2),
        "updated_at": None,
        "resolved_at": None,
        "closed_at": None,
        "resolution_due_at": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _enriched(ticket: SimpleNamespace, *, team: str | None = "Team A", user: str | None = "User A") -> SimpleNamespace:
    return SimpleNamespace(
        id=ticket.id,
        assigned_team_name=team,
        assigned_user_name=user,
    )


def _scalars_result(tickets: list[SimpleNamespace]) -> MagicMock:
    result = MagicMock()
    result.scalars.return_value.all.return_value = tickets
    return result


def _patch_deps(
    *,
    reopened_map: dict | None = None,
    enriched: list | None = None,
):
    """Patch the three dependencies imported into custom_reports."""
    return (
        patch(
            "star_itsm_api.services.custom_reports._ticket_scope_stmt",
            MagicMock(return_value=MagicMock()),
        ),
        patch(
            "star_itsm_api.services.custom_reports._reopened_ticket_ids",
            AsyncMock(return_value=reopened_map if reopened_map is not None else {}),
        ),
        patch(
            "star_itsm_api.services.custom_reports.tickets_to_read_list",
            AsyncMock(return_value=enriched if enriched is not None else []),
        ),
    )


# ---------------------------------------------------------------------------
# make_aware
# ---------------------------------------------------------------------------


def test_make_aware_adds_utc_to_naive() -> None:
    naive = datetime(2026, 6, 1, 12, 0)
    result = cr.make_aware(naive)
    assert result.tzinfo is UTC


def test_make_aware_keeps_existing_tzinfo() -> None:
    aware = datetime(2026, 6, 1, 12, 0, tzinfo=UTC)
    result = cr.make_aware(aware)
    assert result is aware


# ---------------------------------------------------------------------------
# compute_sla_compliance
# ---------------------------------------------------------------------------


def test_sla_compliance_no_due_tickets_returns_100() -> None:
    now = datetime.now(UTC)
    tickets = [_ticket(resolution_due_at=None), _ticket(resolution_due_at=None)]
    assert cr.compute_sla_compliance(tickets, now) == 100.0


def test_sla_compliance_closed_resolved_before_due_is_compliant() -> None:
    now = datetime.now(UTC)
    due = now - timedelta(hours=2)
    ticket = _ticket(
        status="closed",
        resolution_due_at=due,
        resolved_at=due - timedelta(hours=1),
    )
    assert cr.compute_sla_compliance([ticket], now) == 100.0


def test_sla_compliance_closed_resolved_after_due_is_breach() -> None:
    now = datetime.now(UTC)
    due = now - timedelta(hours=2)
    ticket = _ticket(
        status="closed",
        resolution_due_at=due,
        resolved_at=due + timedelta(hours=1),
    )
    assert cr.compute_sla_compliance([ticket], now) == 0.0


def test_sla_compliance_closed_without_resolved_uses_fallback_compliant() -> None:
    now = datetime.now(UTC)
    due = now - timedelta(hours=2)
    # status not open, but resolved_at / closed_at / updated_at all None -> else branch
    ticket = _ticket(
        status="closed",
        resolution_due_at=due,
        resolved_at=None,
        closed_at=None,
        updated_at=None,
    )
    assert cr.compute_sla_compliance([ticket], now) == 100.0


def test_sla_compliance_closed_uses_closed_at_when_no_resolved() -> None:
    now = datetime.now(UTC)
    due = now - timedelta(hours=2)
    ticket = _ticket(
        status="resolved",
        resolution_due_at=due,
        resolved_at=None,
        closed_at=due - timedelta(hours=1),
    )
    assert cr.compute_sla_compliance([ticket], now) == 100.0


def test_sla_compliance_open_within_due_is_compliant() -> None:
    now = datetime.now(UTC)
    ticket = _ticket(status="in_progress", resolution_due_at=now + timedelta(hours=2))
    assert cr.compute_sla_compliance([ticket], now) == 100.0


def test_sla_compliance_open_past_due_is_breach() -> None:
    now = datetime.now(UTC)
    ticket = _ticket(status="in_progress", resolution_due_at=now - timedelta(hours=2))
    assert cr.compute_sla_compliance([ticket], now) == 0.0


def test_sla_compliance_mixed_rounds_to_one_decimal() -> None:
    now = datetime.now(UTC)
    compliant = _ticket(status="in_progress", resolution_due_at=now + timedelta(hours=1))
    breach1 = _ticket(status="in_progress", resolution_due_at=now - timedelta(hours=1))
    breach2 = _ticket(status="in_progress", resolution_due_at=now - timedelta(hours=1))
    # 1 of 3 compliant -> 33.3
    assert cr.compute_sla_compliance([compliant, breach1, breach2], now) == 33.3


# ---------------------------------------------------------------------------
# compute_avg_resolution_time
# ---------------------------------------------------------------------------


def test_avg_resolution_time_none_when_no_resolved() -> None:
    tickets = [_ticket(resolved_at=None)]
    assert cr.compute_avg_resolution_time(tickets) is None


def test_avg_resolution_time_computes_hours() -> None:
    created = datetime(2026, 6, 1, 0, 0, tzinfo=UTC)
    ticket = _ticket(created_at=created, resolved_at=created + timedelta(hours=4))
    assert cr.compute_avg_resolution_time([ticket]) == 4.0


def test_avg_resolution_time_clamps_negative_to_zero() -> None:
    created = datetime(2026, 6, 1, 0, 0, tzinfo=UTC)
    # resolved before created -> negative diff clamped to 0
    ticket = _ticket(created_at=created, resolved_at=created - timedelta(hours=4))
    assert cr.compute_avg_resolution_time([ticket]) == 0.0


# ---------------------------------------------------------------------------
# build_custom_report
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_build_custom_report_group_by_status() -> None:
    now = datetime.now(UTC)
    t1 = _ticket(status="new", created_at=now - timedelta(days=1))
    t2 = _ticket(status="new", created_at=now - timedelta(days=1))
    t3 = _ticket(status="closed", created_at=now - timedelta(days=1))

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_scalars_result([t1, t2, t3]))
    user = SimpleNamespace(id=uuid.uuid4(), role="admin", organization_id=None)

    p_scope, p_reopen, p_enrich = _patch_deps(
        enriched=[_enriched(t1), _enriched(t2), _enriched(t3)]
    )
    with p_scope, p_reopen, p_enrich:
        report = await cr.build_custom_report(mock_db, user, group_by="status", period_days=30)

    assert report.group_by == "status"
    assert report.total_tickets == 3
    # sorted by count desc -> "new" (2) first
    assert report.groups[0].group_key == "new"
    assert report.groups[0].count == 2
    assert report.groups[0].percentage == round(2 / 3 * 100.0, 1)
    assert report.groups[0].group_label_da == "Ny"
    # enriched fields applied to rows
    assert report.groups[0].tickets[0].assigned_team_name == "Team A"


@pytest.mark.asyncio
async def test_build_custom_report_group_by_priority_sorting() -> None:
    now = datetime.now(UTC)
    t_low = _ticket(priority="low", created_at=now - timedelta(days=1))
    t_critical = _ticket(priority="critical", created_at=now - timedelta(days=1))
    t_unknown = _ticket(priority="urgent", created_at=now - timedelta(days=1))

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_scalars_result([t_low, t_critical, t_unknown]))
    user = SimpleNamespace(id=uuid.uuid4(), role="admin", organization_id=None)

    p_scope, p_reopen, p_enrich = _patch_deps()
    with p_scope, p_reopen, p_enrich:
        report = await cr.build_custom_report(mock_db, user, group_by="priority", period_days=30)

    keys = [g.group_key for g in report.groups]
    # critical first, low second, unknown ("urgent") last (999)
    assert keys[0] == "critical"
    assert keys[1] == "low"
    assert keys[-1] == "urgent"
    # unknown priority falls back to capitalize()
    urgent_group = next(g for g in report.groups if g.group_key == "urgent")
    assert urgent_group.group_label_da == "Urgent"


@pytest.mark.asyncio
async def test_build_custom_report_group_by_ticket_type() -> None:
    now = datetime.now(UTC)
    t1 = _ticket(ticket_type="incident", created_at=now - timedelta(days=1))
    t2 = _ticket(ticket_type="problem", created_at=now - timedelta(days=1))
    t3 = _ticket(ticket_type="weird_type", created_at=now - timedelta(days=1))

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_scalars_result([t1, t2, t3]))
    user = SimpleNamespace(id=uuid.uuid4(), role="admin", organization_id=None)

    p_scope, p_reopen, p_enrich = _patch_deps()
    with p_scope, p_reopen, p_enrich:
        report = await cr.build_custom_report(mock_db, user, group_by="ticket_type", period_days=30)

    labels = {g.group_key: g.group_label_da for g in report.groups}
    assert labels["incident"] == "Hændelse (Incident)"
    assert labels["problem"] == "Problem"
    # unknown ticket type falls back to capitalize()
    assert labels["weird_type"] == "Weird_type"


@pytest.mark.asyncio
async def test_build_custom_report_group_by_assigned_team_with_enriched() -> None:
    now = datetime.now(UTC)
    t1 = _ticket(created_at=now - timedelta(days=1))
    t2 = _ticket(created_at=now - timedelta(days=1))

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_scalars_result([t1, t2]))
    user = SimpleNamespace(id=uuid.uuid4(), role="admin", organization_id=None)

    p_scope, p_reopen, p_enrich = _patch_deps(
        enriched=[_enriched(t1, team="Servicedesk"), _enriched(t2, team="Servicedesk")]
    )
    with p_scope, p_reopen, p_enrich:
        report = await cr.build_custom_report(mock_db, user, group_by="assigned_team", period_days=30)

    assert report.groups[0].group_key == "Servicedesk"
    assert report.groups[0].count == 2


@pytest.mark.asyncio
async def test_build_custom_report_assigned_team_fallback_when_no_enriched() -> None:
    now = datetime.now(UTC)
    t1 = _ticket(created_at=now - timedelta(days=1))

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_scalars_result([t1]))
    user = SimpleNamespace(id=uuid.uuid4(), role="admin", organization_id=None)

    # No enriched objects -> enriched is None for each ticket -> fallback label
    p_scope, p_reopen, p_enrich = _patch_deps(enriched=[])
    with p_scope, p_reopen, p_enrich:
        report = await cr.build_custom_report(mock_db, user, group_by="assigned_team", period_days=30)

    assert report.groups[0].group_key == "Ikke tildelt et team"
    # rows are not enriched (no model_copy)
    assert report.groups[0].tickets[0].assigned_team_name is None


@pytest.mark.asyncio
async def test_build_custom_report_unknown_group_by_uses_alle() -> None:
    now = datetime.now(UTC)
    t1 = _ticket(created_at=now - timedelta(days=1))

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_scalars_result([t1]))
    user = SimpleNamespace(id=uuid.uuid4(), role="admin", organization_id=None)

    p_scope, p_reopen, p_enrich = _patch_deps()
    with p_scope, p_reopen, p_enrich:
        report = await cr.build_custom_report(mock_db, user, group_by="something_else", period_days=30)

    assert report.groups[0].group_key == "Alle"
    assert report.groups[0].group_label_da == "Alle"


@pytest.mark.asyncio
async def test_build_custom_report_applies_period_type_priority_filters() -> None:
    now = datetime.now(UTC)
    keep = _ticket(
        created_at=now - timedelta(days=1),
        ticket_type="incident",
        priority="high",
    )
    too_old = _ticket(created_at=now - timedelta(days=100), ticket_type="incident", priority="high")
    wrong_type = _ticket(created_at=now - timedelta(days=1), ticket_type="problem", priority="high")
    wrong_priority = _ticket(created_at=now - timedelta(days=1), ticket_type="incident", priority="low")

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=_scalars_result([keep, too_old, wrong_type, wrong_priority])
    )
    user = SimpleNamespace(id=uuid.uuid4(), role="admin", organization_id=None)

    p_scope, p_reopen, p_enrich = _patch_deps()
    with p_scope, p_reopen, p_enrich:
        report = await cr.build_custom_report(
            mock_db,
            user,
            group_by="status",
            period_days=30,
            ticket_type="incident",
            priority="high",
        )

    assert report.total_tickets == 1


@pytest.mark.asyncio
async def test_build_custom_report_no_period_filter_when_none() -> None:
    now = datetime.now(UTC)
    old = _ticket(created_at=now - timedelta(days=500))

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_scalars_result([old]))
    user = SimpleNamespace(id=uuid.uuid4(), role="admin", organization_id=None)

    p_scope, p_reopen, p_enrich = _patch_deps()
    with p_scope, p_reopen, p_enrich:
        report = await cr.build_custom_report(mock_db, user, group_by="status", period_days=None)

    assert report.total_tickets == 1


@pytest.mark.asyncio
async def test_build_custom_report_empty_tickets() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_scalars_result([]))
    user = SimpleNamespace(id=uuid.uuid4(), role="admin", organization_id=None)

    p_scope, p_reopen, p_enrich = _patch_deps()
    with p_scope, p_reopen, p_enrich:
        report = await cr.build_custom_report(mock_db, user, group_by="status", period_days=30)

    assert report.total_tickets == 0
    assert report.groups == []


@pytest.mark.asyncio
async def test_build_custom_report_enriches_rows_with_reopened_map() -> None:
    now = datetime.now(UTC)
    t1 = _ticket(created_at=now - timedelta(days=1))
    reopened_at = now - timedelta(hours=5)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_scalars_result([t1]))
    user = SimpleNamespace(id=uuid.uuid4(), role="admin", organization_id=None)

    p_scope, p_reopen, p_enrich = _patch_deps(
        reopened_map={t1.id: reopened_at},
        enriched=[_enriched(t1)],
    )
    with p_scope, p_reopen, p_enrich:
        report = await cr.build_custom_report(mock_db, user, group_by="status", period_days=30)

    assert report.groups[0].tickets[0].reopened_at == reopened_at
    assert report.groups[0].tickets[0].assigned_user_name == "User A"


# ---------------------------------------------------------------------------
# build_predefined_reports
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_build_predefined_reports_full() -> None:
    now = datetime.now(UTC)
    created = now - timedelta(hours=10)

    # critical: has SLA + resolved -> contributes to sla, mttr, fcr (incident)
    crit = _ticket(
        priority="critical",
        ticket_type="incident",
        status="closed",
        resolution_due_at=now + timedelta(hours=1),
        created_at=created,
        resolved_at=created + timedelta(hours=2),
    )
    # high: service_request resolved, reopened -> excluded from FCR
    high = _ticket(
        priority="high",
        ticket_type="service_request",
        status="closed",
        resolution_due_at=now + timedelta(hours=1),
        created_at=created,
        resolved_at=created + timedelta(hours=3),
    )
    # medium: no SLA, not resolved, problem type
    medium = _ticket(
        priority="medium",
        ticket_type="problem",
        status="new",
        resolution_due_at=None,
        resolved_at=None,
        created_at=created,
    )

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_scalars_result([crit, high, medium]))
    user = SimpleNamespace(id=uuid.uuid4(), role="admin", organization_id=None)

    p_scope, p_reopen, p_enrich = _patch_deps(reopened_map={high.id: now})
    with p_scope, p_reopen, p_enrich:
        report = await cr.build_predefined_reports(mock_db, user)

    titles = [s.title_da for s in report.sections]
    assert titles == [
        "SLA Overholdelsesrapport",
        "Gennemsnitlig Løsningstid (MTTR)",
        "Førstekontaktsløsning (FCR)",
        "Sagsfordeling (Mængde)",
    ]

    sla_section, mttr_section, fcr_section, dist_section = report.sections

    # SLA: only critical and high have due tickets
    sla_labels = {i.label_da for i in sla_section.items}
    assert sla_labels == {"Kritisk", "Høj"}

    # MTTR: only critical and high resolved
    mttr_labels = {i.label_da for i in mttr_section.items}
    assert mttr_labels == {"Kritisk", "Høj"}

    # FCR: incident (crit, FCR) and service_request (high, reopened -> 0%)
    fcr_by_label = {i.label_da: i.metric_value for i in fcr_section.items}
    assert fcr_by_label["Hændelse (Incident)"] == 100.0
    assert fcr_by_label["Serviceanmodning (Service Request)"] == 0.0

    # Distribution: all three types present
    dist_labels = {i.label_da for i in dist_section.items}
    assert dist_labels == {
        "Hændelse (Incident)",
        "Serviceanmodning (Service Request)",
        "Problem",
    }
    incident_item = next(i for i in dist_section.items if i.label_da == "Hændelse (Incident)")
    assert incident_item.count == 1
    assert incident_item.percentage == round(1 / 3 * 100.0, 1)


@pytest.mark.asyncio
async def test_build_predefined_reports_empty() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_scalars_result([]))
    user = SimpleNamespace(id=uuid.uuid4(), role="admin", organization_id=None)

    p_scope, p_reopen, p_enrich = _patch_deps()
    with p_scope, p_reopen, p_enrich:
        report = await cr.build_predefined_reports(mock_db, user)

    sla_section, mttr_section, fcr_section, dist_section = report.sections
    assert sla_section.items == []
    assert mttr_section.items == []
    assert fcr_section.items == []
    # distribution always lists every known type with 0 count / 0 percentage
    assert len(dist_section.items) == 3
    for item in dist_section.items:
        assert item.count == 0
        assert item.percentage == 0.0
