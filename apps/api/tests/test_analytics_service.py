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
