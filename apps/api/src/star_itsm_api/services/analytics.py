import math
from datetime import UTC, datetime, timedelta
from uuid import UUID
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.category import Category
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.schemas.analytics import (
    AnalyticsResponse,
    CategoryHotspot,
    IntakeHeatmapCell,
    RiskTicket,
)
from star_itsm_api.services.reports import _ticket_scope_stmt, OPEN_STATUSES


async def build_analytics(db: AsyncSession, user: User) -> AnalyticsResponse:
    now = datetime.now(UTC)

    # 1. Fetch categories for mapping
    cat_result = await db.execute(select(Category))
    categories = cat_result.scalars().all()
    category_map = {c.id: c.name_da for c in categories}

    # 2. Fetch all tickets visible to user
    stmt = _ticket_scope_stmt(user)
    ticket_result = await db.execute(stmt)
    tickets = list(ticket_result.scalars().all())

    # --- Group 1: Category Hotspots ---
    # Group tickets by category_id
    tickets_by_cat = defaultdict(list)
    for ticket in tickets:
        tickets_by_cat[ticket.category_id].append(ticket)

    hotspots: list[CategoryHotspot] = []
    for cat_id, cat_tickets in tickets_by_cat.items():
        cat_name = category_map.get(cat_id, "Uklassificeret") if cat_id else "Uklassificeret"

        # Calculate average complexity
        complexities = [t.complexity_score for t in cat_tickets if t.complexity_score is not None]
        avg_complexity = sum(complexities) / len(complexities) if complexities else None

        # Calculate SLA compliance
        # Only count tickets that have a resolution due date
        due_tickets = [t for t in cat_tickets if t.resolution_due_at is not None]
        if due_tickets:
            compliant_count = 0
            for t in due_tickets:
                due_at = t.resolution_due_at
                if due_at.tzinfo is None:
                    due_at = due_at.replace(tzinfo=UTC)

                if t.status not in OPEN_STATUSES:
                    # Closed/resolved ticket
                    resolved_at = t.resolved_at or t.closed_at or t.updated_at
                    if resolved_at:
                        if resolved_at.tzinfo is None:
                            resolved_at = resolved_at.replace(tzinfo=UTC)
                        if resolved_at <= due_at:
                            compliant_count += 1
                    else:
                        # Fallback if resolved_at is missing but closed, assume compliant
                        compliant_count += 1
                else:
                    # Open ticket
                    if now <= due_at:
                        compliant_count += 1
            sla_compliance_pct = round((compliant_count / len(due_tickets)) * 100.0, 1)
        else:
            sla_compliance_pct = 100.0

        # Calculate open count and average age of open tickets
        open_cat_tickets = [t for t in cat_tickets if t.status in OPEN_STATUSES]
        open_count = len(open_cat_tickets)

        if open_cat_tickets:
            total_age_seconds = sum((now - t.created_at.replace(tzinfo=UTC) if t.created_at.tzinfo is None else now - t.created_at).total_seconds() for t in open_cat_tickets)
            avg_age_days = round((total_age_seconds / 86400.0) / open_count, 1)
        else:
            avg_age_days = 0.0

        # Determine risk level
        if sla_compliance_pct < 60.0:
            risk_level = "critical"
        elif sla_compliance_pct < 80.0:
            risk_level = "high"
        elif sla_compliance_pct < 95.0:
            risk_level = "medium"
        else:
            risk_level = "low"

        hotspots.append(
            CategoryHotspot(
                category_id=cat_id,
                category_name_da=cat_name,
                avg_complexity=avg_complexity,
                sla_compliance_pct=sla_compliance_pct,
                open_count=open_count,
                avg_age_days=avg_age_days,
                risk_level=risk_level,
            )
        )

    # Sort hotspots by open count descending
    hotspots.sort(key=lambda h: h.open_count, reverse=True)

    # --- Group 2: Weekly Intake Heatmap ---
    # Day of week: 1=Monday, ..., 7=Sunday (isodow)
    # Hour of day: 0-23
    heatmap_counts = defaultdict(int)
    for ticket in tickets:
        created_at = ticket.created_at
        # isodow is 1-7
        day = created_at.isoweekday()
        hour = created_at.hour
        heatmap_counts[(day, hour)] += 1

    heatmap: list[IntakeHeatmapCell] = []
    for day in range(1, 8):
        for hour in range(24):
            count = heatmap_counts.get((day, hour), 0)
            heatmap.append(
                IntakeHeatmapCell(
                    day_of_week=day,
                    hour_of_day=hour,
                    count=count,
                )
            )

    # --- Group 3: SLA Breach Risk Predictor ---
    risk_tickets: list[RiskTicket] = []
    open_tickets_with_sla = [
        t for t in tickets
        if t.status in OPEN_STATUSES and t.resolution_due_at is not None
    ]

    for t in open_tickets_with_sla:
        due_at = t.resolution_due_at
        if due_at.tzinfo is None:
            due_at = due_at.replace(tzinfo=UTC)

        remaining_seconds = (due_at - now).total_seconds()

        # Calculate risk score
        if remaining_seconds <= 0:
            risk_score = 100.0
        else:
            # Priority multiplier factor: critical=4h, high=12h, medium=24h, low=48h
            priority_factors = {
                "critical": 4.0 * 3600,
                "high": 12.0 * 3600,
                "medium": 24.0 * 3600,
                "low": 48.0 * 3600,
            }
            factor = priority_factors.get(t.priority, 24.0 * 3600)
            risk_score = round(100.0 * math.exp(-remaining_seconds / factor), 1)

        risk_tickets.append(
            RiskTicket(
                id=t.id,
                ticket_number=t.ticket_number,
                title=t.title,
                priority=t.priority,
                remaining_seconds=remaining_seconds,
                risk_score=risk_score,
            )
        )

    # Sort risk tickets by risk score descending, then remaining seconds ascending
    risk_tickets.sort(key=lambda r: (-r.risk_score, r.remaining_seconds))

    # Return top 15 highest risk tickets
    return AnalyticsResponse(
        hotspots=hotspots,
        heatmap=heatmap,
        risk_tickets=risk_tickets[:15],
    )
