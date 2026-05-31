import csv
import io
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.models.user import User
from star_itsm_api.schemas.report import ReportBucket, ReportTicketRow, StandardReportRead
from star_itsm_api.services.org_access import get_user_organization_id
from star_itsm_api.services.permissions import has_full_ticket_visibility
from star_itsm_api.services.ticket_read import tickets_to_read_list

BUCKET_MODTAGET = "modtaget"
BUCKET_IGANGSAT = "igangsat"
BUCKET_LOST = "lost"
BUCKET_LUKKET = "lukket"
BUCKET_GENAABNET = "genaabnet"

STATUS_LABELS_DA: dict[str, str] = {
    "new": "Ny",
    "assigned": "Tildelt",
    "in_progress": "I gang",
    "on_hold": "På hold",
    "resolved": "Løst",
    "closed": "Lukket",
    "cancelled": "Annulleret",
}

BUCKET_DEFINITIONS: list[tuple[str, str, str, frozenset[str]]] = [
    (
        BUCKET_MODTAGET,
        "Modtaget",
        "Sager modtaget og afventer behandling (ny / tildelt)",
        frozenset({"new", "assigned"}),
    ),
    (
        BUCKET_IGANGSAT,
        "Igangsat",
        "Sager under aktiv behandling",
        frozenset({"in_progress", "on_hold"}),
    ),
    (
        BUCKET_LOST,
        "Løst",
        "Sager løst og afventer evt. lukning",
        frozenset({"resolved"}),
    ),
    (
        BUCKET_LUKKET,
        "Lukket",
        "Afsluttede sager (lukket / annulleret)",
        frozenset({"closed", "cancelled"}),
    ),
]

CLOSED_STATUSES = frozenset({"resolved", "closed", "cancelled"})
OPEN_STATUSES = frozenset({"new", "assigned", "in_progress", "on_hold"})


def status_label_da(status: str) -> str:
    return STATUS_LABELS_DA.get(status, status)


def is_reopen_transition(previous: str, new: str) -> bool:
    return previous in CLOSED_STATUSES and new in OPEN_STATUSES


async def _ticket_scope_stmt(user: User):
    stmt = select(Ticket).where(Ticket.deleted_at.is_(None))
    org_id = get_user_organization_id(user)
    if not has_full_ticket_visibility(user) and org_id is not None:
        stmt = stmt.where(Ticket.organization_id == org_id)
    return stmt


async def _reopened_ticket_ids(
    db: AsyncSession,
    *,
    ticket_ids: list[uuid.UUID],
    since: datetime | None,
) -> dict[uuid.UUID, datetime]:
    if not ticket_ids:
        return {}
    stmt = select(TicketEvent).where(
        TicketEvent.ticket_id.in_(ticket_ids),
        TicketEvent.event_type.in_(("ticket.reopened", "ticket.status_changed")),
    )
    if since is not None:
        stmt = stmt.where(TicketEvent.created_at >= since)
    stmt = stmt.order_by(TicketEvent.created_at.asc())
    result = await db.execute(stmt)
    reopened: dict[uuid.UUID, datetime] = {}
    for event in result.scalars().all():
        if event.event_type == "ticket.reopened":
            if event.ticket_id not in reopened:
                reopened[event.ticket_id] = event.created_at
            continue
        payload = event.payload or {}
        previous = payload.get("previous_status")
        new_status = payload.get("status")
        if (
            isinstance(previous, str)
            and isinstance(new_status, str)
            and is_reopen_transition(previous, new_status)
            and event.ticket_id not in reopened
        ):
            reopened[event.ticket_id] = event.created_at
    return reopened


def _to_report_row(ticket: Ticket, *, reopened_at: datetime | None = None) -> ReportTicketRow:
    return ReportTicketRow(
        id=ticket.id,
        ticket_number=ticket.ticket_number,
        title=ticket.title,
        status=ticket.status,
        status_label_da=status_label_da(ticket.status),
        priority=ticket.priority,
        ticket_type=ticket.ticket_type,
        assigned_team_name=None,
        assigned_user_name=None,
        organization_id=getattr(ticket, "organization_id", None),
        created_at=ticket.created_at,
        updated_at=getattr(ticket, "updated_at", None),
        resolved_at=getattr(ticket, "resolved_at", None),
        closed_at=getattr(ticket, "closed_at", None),
        reopened_at=reopened_at,
    )


async def build_standard_report(
    db: AsyncSession,
    user: User,
    *,
    period_days: int | None = 30,
) -> StandardReportRead:
    stmt = await _ticket_scope_stmt(user)
    result = await db.execute(stmt.order_by(Ticket.created_at.desc()))
    tickets = list(result.scalars().all())

    since = None
    if period_days is not None and period_days > 0:
        since = datetime.now(UTC) - timedelta(days=period_days)

    ticket_ids = [t.id for t in tickets]
    reopened_map = await _reopened_ticket_ids(db, ticket_ids=ticket_ids, since=since)

    buckets: list[ReportBucket] = []

    for key, label, description, statuses in BUCKET_DEFINITIONS:
        rows: list[ReportTicketRow] = []
        bucket_tickets = [t for t in tickets if t.status in statuses]
        enrich_by_id = {t.id: t for t in await tickets_to_read_list(db, bucket_tickets)}
        for ticket in bucket_tickets:
            enriched_row = enrich_by_id.get(ticket.id)
            row = _to_report_row(ticket, reopened_at=reopened_map.get(ticket.id))
            if enriched_row:
                row = row.model_copy(
                    update={
                        "assigned_team_name": enriched_row.assigned_team_name,
                        "assigned_user_name": enriched_row.assigned_user_name,
                    }
                )
            rows.append(row)
        buckets.append(
            ReportBucket(
                key=key,
                label_da=label,
                description_da=description,
                count=len(rows),
                tickets=rows,
            )
        )

    reopen_tickets = [t for t in tickets if t.id in reopened_map]
    reopen_enrich_by_id = {t.id: t for t in await tickets_to_read_list(db, reopen_tickets)}

    reopen_rows: list[ReportTicketRow] = []
    for ticket in reopen_tickets:
        reopened_at = reopened_map.get(ticket.id)
        if reopened_at is None:
            continue
        enriched_row = reopen_enrich_by_id.get(ticket.id)
        row = _to_report_row(ticket, reopened_at=reopened_at)
        if enriched_row:
            row = row.model_copy(
                update={
                    "assigned_team_name": enriched_row.assigned_team_name,
                    "assigned_user_name": enriched_row.assigned_user_name,
                }
            )
        reopen_rows.append(row)
    reopen_rows.sort(key=lambda r: r.reopened_at or r.created_at, reverse=True)

    buckets.append(
        ReportBucket(
            key=BUCKET_GENAABNET,
            label_da="Genåbnet",
            description_da="Sager der er genåbnet efter løsning eller lukning",
            count=len(reopen_rows),
            tickets=reopen_rows,
        )
    )

    return StandardReportRead(
        generated_at=datetime.now(UTC),
        period_days=period_days,
        total_tickets=len(tickets),
        buckets=buckets,
    )


def report_to_csv(report: StandardReportRead, *, bucket_key: str | None = None) -> str:
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    buckets = report.buckets
    if bucket_key:
        buckets = [b for b in buckets if b.key == bucket_key]

    writer.writerow(["STARdesk standardrapport"])
    writer.writerow(["Genereret", report.generated_at.isoformat()])
    if report.period_days:
        writer.writerow(["Periode (dage)", report.period_days])
    writer.writerow([])

    for bucket in buckets:
        writer.writerow([bucket.label_da, f"Antal: {bucket.count}"])
        writer.writerow(
            [
                "Sagsnr",
                "Titel",
                "Status",
                "Prioritet",
                "Type",
                "Gruppe",
                "Sagsbehandler",
                "Oprettet",
                "Løst",
                "Lukket",
                "Genåbnet",
            ]
        )
        for row in bucket.tickets:
            writer.writerow(
                [
                    row.ticket_number,
                    row.title,
                    row.status_label_da,
                    row.priority,
                    row.ticket_type,
                    row.assigned_team_name or "",
                    row.assigned_user_name or "",
                    row.created_at.isoformat(),
                    row.resolved_at.isoformat() if row.resolved_at else "",
                    row.closed_at.isoformat() if row.closed_at else "",
                    row.reopened_at.isoformat() if row.reopened_at else "",
                ]
            )
        writer.writerow([])

    return output.getvalue()
