import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.models.category import Category
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services.analytics import build_analytics


@pytest.mark.asyncio
async def test_build_analytics_aggregates_correctly() -> None:
    # Set up mock database session
    mock_db = AsyncMock()

    # Mock categories
    cat1_id = uuid.uuid4()
    cat2_id = uuid.uuid4()
    cat1 = Category(id=cat1_id, name="Hardware", name_da="Maskinel", sort_order=1, is_active=True)
    cat2 = Category(id=cat2_id, name="Software", name_da="Programmel", sort_order=2, is_active=True)

    # Mock tickets
    t1 = Ticket(
        id=uuid.uuid4(),
        ticket_number="INC-001",
        ticket_type="incident",
        title="My computer is broken",
        description="Broken screen",
        status="new",
        priority="critical",
        reporter_user_id=uuid.uuid4(),
        category_id=cat1_id,
        complexity_score=4,
        source="web",
        created_at=datetime.now(UTC) - timedelta(hours=2),
        resolution_due_at=datetime.now(UTC) + timedelta(days=1),
    )
    t2 = Ticket(
        id=uuid.uuid4(),
        ticket_number="INC-002",
        ticket_type="incident",
        title="Need Excel",
        description="Please install Excel",
        status="resolved",
        priority="medium",
        reporter_user_id=uuid.uuid4(),
        category_id=cat2_id,
        complexity_score=2,
        source="web",
        created_at=datetime(2026, 6, 4, 11, 0, tzinfo=UTC),
        resolution_due_at=datetime(2026, 6, 4, 15, 0, tzinfo=UTC),
        resolved_at=datetime(2026, 6, 4, 12, 0, tzinfo=UTC),
    )

    # Mock db.execute responses
    # First execute is for categories
    cat_execute_result = MagicMock()
    cat_execute_result.scalars.return_value.all.return_value = [cat1, cat2]

    # Second execute is for tickets
    ticket_execute_result = MagicMock()
    ticket_execute_result.scalars.return_value.all.return_value = [t1, t2]

    mock_db.execute.side_effect = [cat_execute_result, ticket_execute_result]

    # Call service
    mock_user = MagicMock()
    with patch("star_itsm_api.services.analytics._ticket_scope_stmt") as mock_scope_stmt:
        mock_scope_stmt.return_value = MagicMock()
        response = await build_analytics(mock_db, mock_user)

    # Assertions
    assert len(response.hotspots) == 2
    # Sort hotspots by name to check values
    hotspots_by_name = {h.category_name_da: h for h in response.hotspots}
    assert "Maskinel" in hotspots_by_name
    assert "Programmel" in hotspots_by_name

    maskinel = hotspots_by_name["Maskinel"]
    assert maskinel.open_count == 1
    assert maskinel.avg_complexity == 4.0
    assert maskinel.sla_compliance_pct == 100.0  # Open but not yet breached in mock setup depending on 'now'

    programmel = hotspots_by_name["Programmel"]
    assert programmel.open_count == 0
    assert programmel.avg_complexity == 2.0
    assert programmel.sla_compliance_pct == 100.0  # Resolved at 12:00, due at 15:00

    # Heatmap checks
    assert len(response.heatmap) == 7 * 24
    t1_day = t1.created_at.isoweekday()
    t1_hour = t1.created_at.hour
    t2_day = t2.created_at.isoweekday()
    t2_hour = t2.created_at.hour

    cell_t1 = next(c for c in response.heatmap if c.day_of_week == t1_day and c.hour_of_day == t1_hour)
    cell_t2 = next(c for c in response.heatmap if c.day_of_week == t2_day and c.hour_of_day == t2_hour)
    
    if t1_day == t2_day and t1_hour == t2_hour:
        assert cell_t1.count == 2
    else:
        assert cell_t1.count == 1
        assert cell_t2.count == 1

    # Risk tickets checks
    # Only t1 is open and has SLA
    assert len(response.risk_tickets) == 1
    assert response.risk_tickets[0].ticket_number == "INC-001"


@pytest.mark.asyncio
async def test_build_analytics_edge_cases() -> None:
    # Set up mock database session
    mock_db = AsyncMock()

    # Mock categories
    cat1_id = uuid.uuid4()
    cat1 = Category(id=cat1_id, name="Hardware", name_da="Maskinel", sort_order=1, is_active=True)

    # Mock tickets with various edge cases:
    # 1. Naive datetimes (no tzinfo)
    # 2. Closed ticket without resolved_at (fallback compliance)
    # 3. Overdue open ticket (remaining_seconds <= 0)
    # 4. Different risk levels based on compliance pct
    now = datetime.now(UTC)
    
    # Ticket 1: Naive datetimes, open, overdue (remaining <= 0) -> risk_score = 100.0
    t1 = Ticket(
        id=uuid.uuid4(),
        ticket_number="INC-001",
        ticket_type="incident",
        title="Naive overdue",
        status="new",
        priority="critical",
        reporter_user_id=uuid.uuid4(),
        category_id=cat1_id,
        complexity_score=None,  # test None complexity
        source="web",
        created_at=datetime(2026, 6, 1, 12, 0),  # naive
        resolution_due_at=datetime(2026, 6, 1, 13, 0),  # naive, past due
    )
    
    # Ticket 2: Closed, naive resolved_at, resolved after due_at -> non-compliant
    t2 = Ticket(
        id=uuid.uuid4(),
        ticket_number="INC-002",
        ticket_type="incident",
        title="Naive closed non-compliant",
        status="resolved",
        priority="high",
        reporter_user_id=uuid.uuid4(),
        category_id=cat1_id,
        complexity_score=3,
        source="web",
        created_at=datetime(2026, 6, 1, 12, 0),
        resolution_due_at=datetime(2026, 6, 1, 13, 0),
        resolved_at=datetime(2026, 6, 1, 14, 0),  # naive, resolved late
    )
    
    # Ticket 3: Closed, missing resolved_at -> fallback compliant
    t3 = Ticket(
        id=uuid.uuid4(),
        ticket_number="INC-003",
        ticket_type="incident",
        title="Closed missing resolved_at",
        status="closed",
        priority="medium",
        reporter_user_id=uuid.uuid4(),
        category_id=cat1_id,
        complexity_score=3,
        source="web",
        created_at=datetime(2026, 6, 1, 12, 0, tzinfo=UTC),
        resolution_due_at=datetime(2026, 6, 1, 13, 0, tzinfo=UTC),
        resolved_at=None,  # missing
        closed_at=None,
        updated_at=None,
    )

    # Mock db.execute responses
    cat_execute_result = MagicMock()
    cat_execute_result.scalars.return_value.all.return_value = [cat1]

    ticket_execute_result = MagicMock()
    ticket_execute_result.scalars.return_value.all.return_value = [t1, t2, t3]

    mock_db.execute.side_effect = [cat_execute_result, ticket_execute_result]

    mock_user = MagicMock()
    with patch("star_itsm_api.services.analytics._ticket_scope_stmt") as mock_scope_stmt:
        mock_scope_stmt.return_value = MagicMock()
        response = await build_analytics(mock_db, mock_user)

    assert len(response.hotspots) == 1
    hotspot = response.hotspots[0]
    
    # 3 due tickets: t1 (overdue -> non-compliant), t2 (resolved late -> non-compliant), t3 (missing resolved_at -> compliant)
    # compliance = 1 / 3 = 33.3% (< 60.0% -> risk_level = "critical")
    assert hotspot.sla_compliance_pct == 33.3
    assert hotspot.risk_level == "critical"
    assert hotspot.avg_complexity == 3.0  # (3 + 3) / 2
    
    # Risk tickets check
    assert len(response.risk_tickets) == 1
    assert response.risk_tickets[0].risk_score == 100.0


@pytest.mark.asyncio
async def test_build_analytics_risk_levels() -> None:
    # Test different risk levels based on compliance percentage (critical, high, medium, low)
    mock_user = MagicMock()
    
    for total, compliant_count, expected_risk in [
        (2, 1, "critical"),  # 50%
        (4, 3, "high"),      # 75%
        (10, 9, "medium"),    # 90%
        (10, 10, "low"),     # 100%
    ]:
        mock_db = AsyncMock()
        cat1_id = uuid.uuid4()
        cat1 = Category(id=cat1_id, name="Hardware", name_da="Maskinel", sort_order=1, is_active=True)
        
        tickets = []
        now = datetime.now(UTC)
        
        for i in range(total):
            is_compliant = i < compliant_count
            due_at = now + timedelta(days=1) if is_compliant else now - timedelta(days=1)
            tickets.append(
                Ticket(
                    id=uuid.uuid4(),
                    ticket_number=f"INC-{i}",
                    ticket_type="incident",
                    title="T",
                    status="new",
                    priority="medium",
                    reporter_user_id=uuid.uuid4(),
                    category_id=cat1_id,
                    complexity_score=3,
                    source="web",
                    created_at=now - timedelta(hours=2),
                    resolution_due_at=due_at,
                )
            )
            
        cat_execute_result = MagicMock()
        cat_execute_result.scalars.return_value.all.return_value = [cat1]

        ticket_execute_result = MagicMock()
        ticket_execute_result.scalars.return_value.all.return_value = tickets

        mock_db.execute.side_effect = [cat_execute_result, ticket_execute_result]
        
        with patch("star_itsm_api.services.analytics._ticket_scope_stmt") as mock_scope_stmt:
            mock_scope_stmt.return_value = MagicMock()
            response = await build_analytics(mock_db, mock_user)
            
        assert len(response.hotspots) == 1
        assert response.hotspots[0].risk_level == expected_risk


@pytest.mark.asyncio
async def test_build_analytics_no_due_tickets() -> None:
    # Test when there are no tickets with resolution_due_at -> compliance is 100.0
    mock_db = AsyncMock()
    cat1_id = uuid.uuid4()
    cat1 = Category(id=cat1_id, name="Hardware", name_da="Maskinel", sort_order=1, is_active=True)
    
    t = Ticket(
        id=uuid.uuid4(),
        ticket_number="INC-1",
        ticket_type="incident",
        title="T",
        status="new",
        priority="medium",
        reporter_user_id=uuid.uuid4(),
        category_id=cat1_id,
        complexity_score=3,
        source="web",
        created_at=datetime.now(UTC),
        resolution_due_at=None,  # No due date
    )
    
    cat_execute_result = MagicMock()
    cat_execute_result.scalars.return_value.all.return_value = [cat1]

    ticket_execute_result = MagicMock()
    ticket_execute_result.scalars.return_value.all.return_value = [t]

    mock_db.execute.side_effect = [cat_execute_result, ticket_execute_result]
    
    mock_user = MagicMock()
    with patch("star_itsm_api.services.analytics._ticket_scope_stmt") as mock_scope_stmt:
        mock_scope_stmt.return_value = MagicMock()
        response = await build_analytics(mock_db, mock_user)
        
    assert len(response.hotspots) == 1
    assert response.hotspots[0].sla_compliance_pct == 100.0


