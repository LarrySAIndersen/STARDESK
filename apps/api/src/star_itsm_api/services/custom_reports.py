from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.schemas.custom_reports import (
    CustomReportGroupRow,
    CustomReportResponse,
    PredefinedReportItem,
    PredefinedReportSection,
    PredefinedReportsResponse,
)
from star_itsm_api.services.reports import (
    OPEN_STATUSES,
    _reopened_ticket_ids,
    _ticket_scope_stmt,
    _to_report_row,
    status_label_da,
)
from star_itsm_api.services.ticket_read import tickets_to_read_list

PRIORITY_LABELS_DA = {
    "critical": "Kritisk",
    "high": "Høj",
    "medium": "Medium",
    "low": "Lav",
}

TICKET_TYPE_LABELS_DA = {
    "incident": "Hændelse (Incident)",
    "service_request": "Serviceanmodning (Service Request)",
    "problem": "Problem",
}


def make_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def compute_sla_compliance(tickets: list[Ticket], now: datetime) -> float:
    due_tickets = [t for t in tickets if t.resolution_due_at is not None]
    if not due_tickets:
        return 100.0

    compliant_count = 0
    for t in due_tickets:
        due_at = make_aware(t.resolution_due_at)
        if t.status not in OPEN_STATUSES:
            resolved_at = t.resolved_at or t.closed_at or t.updated_at
            if resolved_at:
                resolved_at = make_aware(resolved_at)
                if resolved_at <= due_at:
                    compliant_count += 1
            else:
                compliant_count += 1
        else:
            if now <= due_at:
                compliant_count += 1

    return round((compliant_count / len(due_tickets)) * 100.0, 1)


def compute_avg_resolution_time(tickets: list[Ticket]) -> float | None:
    resolved_tickets = [t for t in tickets if t.resolved_at is not None]
    if not resolved_tickets:
        return None

    total_hours = 0.0
    for t in resolved_tickets:
        start = make_aware(t.created_at)
        end = make_aware(t.resolved_at)
        diff = (end - start).total_seconds() / 3600.0
        total_hours += max(diff, 0.0)

    return round(total_hours / len(resolved_tickets), 1)


async def build_custom_report(
    db: AsyncSession,
    user: User,
    *,
    group_by: str,  # "status", "priority", "assigned_team", "ticket_type"
    ticket_type: str | None = None,
    priority: str | None = None,
    period_days: int | None = 30,
) -> CustomReportResponse:
    now = datetime.now(UTC)
    stmt = _ticket_scope_stmt(user)
    result = await db.execute(stmt)
    tickets = list(result.scalars().all())

    # Filter tickets
    if period_days is not None and period_days > 0:
        since = now - timedelta(days=period_days)
        tickets = [t for t in tickets if make_aware(t.created_at) >= since]

    if ticket_type:
        tickets = [t for t in tickets if t.ticket_type == ticket_type]

    if priority:
        tickets = [t for t in tickets if t.priority == priority]

    total_tickets = len(tickets)

    # Get reopened map to enrich rows
    ticket_ids = [t.id for t in tickets]
    reopened_map = await _reopened_ticket_ids(db, ticket_ids=ticket_ids, since=None)

    # Enrich tickets
    enriched_by_id = {t.id: t for t in await tickets_to_read_list(db, tickets)}

    # Group tickets
    grouped_tickets = defaultdict(list)
    for t in tickets:
        if group_by == "status":
            grouped_tickets[t.status].append(t)
        elif group_by == "priority":
            grouped_tickets[t.priority].append(t)
        elif group_by == "ticket_type":
            grouped_tickets[t.ticket_type].append(t)
        elif group_by == "assigned_team":
            # Use enriched team name or fall back
            enriched = enriched_by_id.get(t.id)
            team_name = enriched.assigned_team_name if enriched else None
            team_name = team_name or "Ikke tildelt et team"
            grouped_tickets[team_name].append(t)
        else:
            grouped_tickets["Alle"].append(t)

    groups: list[CustomReportGroupRow] = []

    for key, group_tkts in grouped_tickets.items():
        # Get labels
        if group_by == "status":
            label = status_label_da(key)
        elif group_by == "priority":
            label = PRIORITY_LABELS_DA.get(key, key.capitalize())
        elif group_by == "ticket_type":
            label = TICKET_TYPE_LABELS_DA.get(key, key.capitalize())
        else:
            label = str(key)

        percentage = round((len(group_tkts) / total_tickets) * 100.0, 1) if total_tickets > 0 else 0.0
        avg_res = compute_avg_resolution_time(group_tkts)
        sla_comp = compute_sla_compliance(group_tkts, now)

        # Convert to ReportTicketRows
        rows = []
        for t in group_tkts:
            enriched = enriched_by_id.get(t.id)
            row = _to_report_row(t, reopened_at=reopened_map.get(t.id))
            if enriched:
                row = row.model_copy(
                    update={
                        "assigned_team_name": enriched.assigned_team_name,
                        "assigned_user_name": enriched.assigned_user_name,
                    }
                )
            rows.append(row)

        groups.append(
            CustomReportGroupRow(
                group_key=str(key),
                group_label_da=label,
                count=len(group_tkts),
                percentage=percentage,
                avg_resolution_time_hours=avg_res,
                sla_compliance_pct=sla_comp,
                tickets=rows,
            )
        )

    # Sort groups: for status, follow standard pipeline; for priority, standard priority order; for others, count desc
    if group_by == "priority":
        groups.sort(key=lambda g: ["critical", "high", "medium", "low"].index(g.group_key) if g.group_key in ["critical", "high", "medium", "low"] else 999)
    else:
        groups.sort(key=lambda g: g.count, reverse=True)

    return CustomReportResponse(
        generated_at=now,
        group_by=group_by,
        total_tickets=total_tickets,
        groups=groups,
    )


async def build_predefined_reports(db: AsyncSession, user: User) -> PredefinedReportsResponse:
    now = datetime.now(UTC)
    stmt = _ticket_scope_stmt(user)
    result = await db.execute(stmt)
    tickets = list(result.scalars().all())
    total_tickets = len(tickets)

    # 1. SLA Compliance Section
    # Break down SLA compliance by priority
    sla_items = []
    tickets_by_priority = defaultdict(list)
    for t in tickets:
        tickets_by_priority[t.priority].append(t)

    for priority_key in ["critical", "high", "medium", "low"]:
        priority_tickets = tickets_by_priority.get(priority_key, [])
        label = PRIORITY_LABELS_DA.get(priority_key, priority_key.capitalize())
        # Filter to those with SLA
        due_tickets = [t for t in priority_tickets if t.resolution_due_at is not None]
        if due_tickets:
            comp = compute_sla_compliance(priority_tickets, now)
            sla_items.append(
                PredefinedReportItem(
                    label_da=label,
                    count=len(priority_tickets),
                    metric_value=comp,
                    metric_label_da=f"{comp}% overholdt",
                    percentage=round((len(priority_tickets) / total_tickets) * 100.0, 1) if total_tickets > 0 else 0.0,
                )
            )

    sla_section = PredefinedReportSection(
        title_da="SLA Overholdelsesrapport",
        description_da="Viser hvor stor en procentdel af sagerne, der løses eller håndteres inden for de aftalte servicemål (SLA) opdelt på prioritet.",
        metric_name_da="SLA Overholdelsesgrad",
        items=sla_items,
    )

    # 2. MTTR Section
    # Mean Time to Resolution by priority
    mttr_items = []
    for priority_key in ["critical", "high", "medium", "low"]:
        priority_tickets = tickets_by_priority.get(priority_key, [])
        label = PRIORITY_LABELS_DA.get(priority_key, priority_key.capitalize())
        avg_res = compute_avg_resolution_time(priority_tickets)
        if avg_res is not None:
            mttr_items.append(
                PredefinedReportItem(
                    label_da=label,
                    count=len([t for t in priority_tickets if t.resolved_at is not None]),
                    metric_value=avg_res,
                    metric_label_da=f"{avg_res} timer (gns.)",
                    percentage=None,
                )
            )

    mttr_section = PredefinedReportSection(
        title_da="Gennemsnitlig Løsningstid (MTTR)",
        description_da="Måler den gennemsnitlige tid i timer fra en sag oprettes til den markeres som løst, opdelt efter prioritet.",
        metric_name_da="MTTR (timer)",
        items=mttr_items,
    )

    # 3. First Contact Resolution (FCR) Section
    # FCR defined as: resolved tickets which have never been reopened.
    # To check reopens, we get reopened map for all tickets
    ticket_ids = [t.id for t in tickets]
    reopened_map = await _reopened_ticket_ids(db, ticket_ids=ticket_ids, since=None)

    resolved_tickets = [t for t in tickets if t.resolved_at is not None]
    tickets_by_type = defaultdict(list)
    for t in resolved_tickets:
        tickets_by_type[t.ticket_type].append(t)

    fcr_items = []
    for type_key in ["incident", "service_request"]:
        type_tickets = tickets_by_type.get(type_key, [])
        label = TICKET_TYPE_LABELS_DA.get(type_key, type_key.capitalize())
        if type_tickets:
            fcr_tickets = [t for t in type_tickets if t.id not in reopened_map]
            fcr_pct = round((len(fcr_tickets) / len(type_tickets)) * 100.0, 1)
            fcr_items.append(
                PredefinedReportItem(
                    label_da=label,
                    count=len(type_tickets),
                    metric_value=fcr_pct,
                    metric_label_da=f"{fcr_pct}% FCR grad",
                    percentage=None,
                )
            )

    fcr_section = PredefinedReportSection(
        title_da="Førstekontaktsløsning (FCR)",
        description_da="Andelen af løste sager, der løses i første forsøg uden nogensinde at have været genåbnet.",
        metric_name_da="FCR Overholdelsesgrad",
        items=fcr_items,
    )

    # 4. Ticket Distribution Section
    dist_items = []
    tickets_by_type_all = defaultdict(list)
    for t in tickets:
        tickets_by_type_all[t.ticket_type].append(t)

    for type_key, label in TICKET_TYPE_LABELS_DA.items():
        type_tickets = tickets_by_type_all.get(type_key, [])
        pct = round((len(type_tickets) / total_tickets) * 100.0, 1) if total_tickets > 0 else 0.0
        dist_items.append(
            PredefinedReportItem(
                label_da=label,
                count=len(type_tickets),
                metric_value=float(len(type_tickets)),
                metric_label_da=f"{len(type_tickets)} sager",
                percentage=pct,
            )
        )

    dist_section = PredefinedReportSection(
        title_da="Sagsfordeling (Mængde)",
        description_da="Mængdemæssig fordeling af sager fordelt på hændelser (incidents), serviceanmodninger (service requests) og problemer.",
        metric_name_da="Antal Sager",
        items=dist_items,
    )

    return PredefinedReportsResponse(
        generated_at=now,
        sections=[sla_section, mttr_section, fcr_section, dist_section],
    )
