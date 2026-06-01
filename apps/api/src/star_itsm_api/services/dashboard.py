from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.schemas.dashboard import (
    CountByLabel,
    DailyCount,
    DashboardRead,
    LongestOpenTicket,
)
from star_itsm_api.services.dashboard_scope import (
    DashboardScope,
    default_dashboard_scope,
    filter_tickets_by_scope,
)
from star_itsm_api.services.reports import (
    BUCKET_DEFINITIONS,
    OPEN_STATUSES,
    _ticket_scope_stmt,
    status_label_da,
)
from star_itsm_api.services.sla_enrichment import effective_resolution_due_at
from star_itsm_api.services.sla_status import sla_breached, sla_due_soon
from star_itsm_api.services.teams import get_user_team_ids
from star_itsm_api.services.ticket_read import tickets_to_read_list

PRIORITY_ORDER = ("critical", "high", "medium", "low")
PRIORITY_LABELS_DA = {
    "critical": "Kritisk",
    "high": "Høj",
    "medium": "Medium",
    "low": "Lav",
}

CLOSED_STATUSES = frozenset({"resolved", "closed", "cancelled"})


def _days_between(start: datetime, end: datetime) -> float:
    delta = end - start
    return max(delta.total_seconds() / 86400, 0)


async def build_dashboard(
    db: AsyncSession,
    user: User,
    *,
    scope: DashboardScope | None = None,
) -> DashboardRead:
    now = datetime.now(UTC)
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)
    chart_start = (now - timedelta(days=13)).date()

    effective_scope = scope or default_dashboard_scope(user)

    stmt = _ticket_scope_stmt(user)
    result = await db.execute(stmt)
    tickets = list(result.scalars().all())
    if effective_scope != DashboardScope.all:
        team_ids = await get_user_team_ids(db, user.id)
        tickets = filter_tickets_by_scope(
            tickets,
            user=user,
            team_ids=team_ids,
            scope=effective_scope,
        )

    open_count = 0
    closed_count = 0
    major_open_count = 0
    sla_overdue_count = 0
    sla_due_soon_count = 0
    opened_last_7_days = 0
    closed_last_7_days = 0
    closed_last_30_days = 0
    open_ages_days: list[float] = []
    longest: Ticket | None = None
    longest_age = -1.0

    status_counts: dict[str, int] = defaultdict(int)
    priority_counts: dict[str, int] = defaultdict(int)
    bucket_counts_map: dict[str, int] = dict.fromkeys(
        (key for key, *_ in BUCKET_DEFINITIONS),
        0,
    )
    created_by_day: dict[str, int] = defaultdict(int)
    closed_by_day: dict[str, int] = defaultdict(int)

    for day_offset in range(14):
        day = chart_start + timedelta(days=day_offset)
        created_by_day[day.isoformat()] = 0
        closed_by_day[day.isoformat()] = 0

    for ticket in tickets:
        status_counts[ticket.status] += 1
        if ticket.status in OPEN_STATUSES:
            priority_counts[ticket.priority] += 1

        for key, _, _, statuses in BUCKET_DEFINITIONS:
            if ticket.status in statuses:
                bucket_counts_map[key] += 1
                break

        created_day = ticket.created_at.date().isoformat()
        if created_day in created_by_day:
            created_by_day[created_day] += 1
        if ticket.created_at >= seven_days_ago:
            opened_last_7_days += 1

        if ticket.status in CLOSED_STATUSES:
            closed_count += 1
            closed_at = ticket.closed_at or ticket.resolved_at or ticket.updated_at
            if closed_at:
                if closed_at >= seven_days_ago:
                    closed_last_7_days += 1
                if closed_at >= thirty_days_ago:
                    closed_last_30_days += 1
                closed_day = closed_at.date().isoformat()
                if closed_day in closed_by_day:
                    closed_by_day[closed_day] += 1

        if ticket.status not in OPEN_STATUSES:
            continue

        open_count += 1
        if ticket.is_major:
            major_open_count += 1

        age_days = _days_between(ticket.created_at, now)
        open_ages_days.append(age_days)
        if age_days > longest_age:
            longest_age = age_days
            longest = ticket

        resolution_due = effective_resolution_due_at(ticket)
        if sla_breached(resolution_due, now=now, status=ticket.status):
            sla_overdue_count += 1
        elif sla_due_soon(resolution_due, now=now, status=ticket.status):
            sla_due_soon_count += 1

    longest_open: LongestOpenTicket | None = None
    if longest is not None:
        enriched_row = None
        try:
            enriched_rows = await tickets_to_read_list(db, [longest])
            enriched_row = enriched_rows[0] if enriched_rows else None
        except Exception:
            enriched_row = None
        hours_open = longest_age * 24
        longest_open = LongestOpenTicket(
            id=longest.id,
            ticket_number=longest.ticket_number,
            title=longest.title,
            status=longest.status,
            status_label_da=status_label_da(longest.status),
            days_open=round(longest_age, 1),
            hours_open=round(hours_open, 1),
            created_at=longest.created_at,
            assigned_team_name=enriched_row.assigned_team_name if enriched_row else None,
            assigned_user_name=enriched_row.assigned_user_name if enriched_row else None,
            priority=longest.priority,
            resolution_due_at=enriched_row.resolution_due_at if enriched_row else None,
            sla_remaining_seconds=enriched_row.sla_remaining_seconds if enriched_row else None,
            sla_breached=enriched_row.sla_breached if enriched_row else False,
        )

    avg_open_age_days = (
        round(sum(open_ages_days) / len(open_ages_days), 1) if open_ages_days else None
    )
    denominator = closed_last_30_days + open_count
    resolution_rate_pct = (
        round(100 * closed_last_30_days / denominator, 1) if denominator > 0 else 0.0
    )

    status_breakdown = [
        CountByLabel(
            key=status,
            label_da=status_label_da(status),
            count=count,
        )
        for status, count in sorted(status_counts.items(), key=lambda x: -x[1])
    ]

    priority_breakdown = [
        CountByLabel(
            key=priority,
            label_da=PRIORITY_LABELS_DA.get(priority, priority),
            count=priority_counts.get(priority, 0),
        )
        for priority in PRIORITY_ORDER
        if priority_counts.get(priority, 0) > 0
    ]

    bucket_counts = [
        CountByLabel(key=key, label_da=label, count=bucket_counts_map[key])
        for key, label, _, _ in BUCKET_DEFINITIONS
    ]

    daily_created = [
        DailyCount(date=day, count=created_by_day[day]) for day in sorted(created_by_day.keys())
    ]
    daily_closed = [
        DailyCount(date=day, count=closed_by_day[day]) for day in sorted(closed_by_day.keys())
    ]

    return DashboardRead(
        generated_at=now,
        open_count=open_count,
        closed_count=closed_count,
        major_open_count=major_open_count,
        sla_overdue_count=sla_overdue_count,
        sla_due_soon_count=sla_due_soon_count,
        opened_last_7_days=opened_last_7_days,
        closed_last_7_days=closed_last_7_days,
        avg_open_age_days=avg_open_age_days,
        resolution_rate_pct=resolution_rate_pct,
        longest_open=longest_open,
        status_breakdown=status_breakdown,
        priority_breakdown=priority_breakdown,
        bucket_counts=bucket_counts,
        daily_created=daily_created,
        daily_closed=daily_closed,
    )
