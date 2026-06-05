from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import require_staff
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.analytics import AnalyticsResponse
from star_itsm_api.schemas.custom_reports import CustomReportResponse, PredefinedReportsResponse
from star_itsm_api.schemas.dashboard import DashboardRead
from star_itsm_api.schemas.report import StandardReportRead
from star_itsm_api.services.analytics import build_analytics
from star_itsm_api.services.custom_reports import build_custom_report, build_predefined_reports
from star_itsm_api.services.dashboard import build_dashboard
from star_itsm_api.services.dashboard_scope import (
    default_dashboard_scope,
    parse_dashboard_scope,
)
from star_itsm_api.services.reports import build_standard_report, report_to_csv
from star_itsm_api.services.ticket_export import build_tickets_export_xlsx

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard")
async def get_operations_dashboard(
    scope: str | None = Query(
        default=None,
        description="personal (default for agents), mine, group, created, all (default for admins)",
    ),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> DashboardRead:
    parsed = parse_dashboard_scope(scope)
    if scope is not None and parsed is None:
        raise HTTPException(status_code=400, detail="Invalid scope")
    effective = parsed or default_dashboard_scope(current_user)
    return await build_dashboard(db, current_user, scope=effective)


@router.get("/standard")
async def get_standard_report(
    period_days: int | None = Query(default=30, ge=0, le=365),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> StandardReportRead:
    days = period_days if period_days and period_days > 0 else None
    return await build_standard_report(db, current_user, period_days=days)


@router.get("/analytics")
async def get_ticket_analytics(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> AnalyticsResponse:
    return await build_analytics(db, current_user)


@router.get("/custom")
async def get_custom_report(
    group_by: str = Query(default="status", description="status, priority, assigned_team, ticket_type"),
    ticket_type: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    period_days: int | None = Query(default=30, ge=0, le=365),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> CustomReportResponse:
    return await build_custom_report(
        db,
        current_user,
        group_by=group_by,
        ticket_type=ticket_type,
        priority=priority,
        period_days=period_days,
    )


@router.get("/custom/export")
async def export_custom_report(
    group_by: str = Query(default="status"),
    ticket_type: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    period_days: int | None = Query(default=30, ge=0, le=365),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> PlainTextResponse:
    import csv
    import io
    report = await build_custom_report(
        db,
        current_user,
        group_by=group_by,
        ticket_type=ticket_type,
        priority=priority,
        period_days=period_days,
    )
    
    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["STARdesk brugerdefineret rapport"])
    writer.writerow(["Grupperet efter", group_by])
    writer.writerow(["Genereret", report.generated_at.isoformat()])
    if period_days:
        writer.writerow(["Periode (dage)", period_days])
    if ticket_type:
        writer.writerow(["Sagstype", ticket_type])
    if priority:
        writer.writerow(["Prioritet", priority])
    writer.writerow([])
    
    for group in report.groups:
        writer.writerow([group.group_label_da, f"Antal sager: {group.count}", f"Procent: {group.percentage}%", f"Gns. loesningstid (timer): {group.avg_resolution_time_hours or ''}", f"SLA overholdelse: {group.sla_compliance_pct or ''}%"])
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
                "Loest",
                "Lukket",
                "Genaabnet",
            ]
        )
        for row in group.tickets:
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
        
    csv_body = output.getvalue()
    filename = f"stardesk-brugerdefineret-{group_by}.csv"
    return PlainTextResponse(
        content="\ufeff" + csv_body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/predefined")
async def get_predefined_reports(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> PredefinedReportsResponse:
    return await build_predefined_reports(db, current_user)


@router.get("/standard/export")
async def export_standard_report(
    bucket: str | None = Query(
        default=None,
        description="modtaget, igangsat, lost, lukket, genaabnet",
    ),
    period_days: int | None = Query(default=30, ge=0, le=365),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> PlainTextResponse:
    days = period_days if period_days and period_days > 0 else None
    report = await build_standard_report(db, current_user, period_days=days)
    csv_body = report_to_csv(report, bucket_key=bucket)
    filename = f"stardesk-rapport-{bucket or 'alle'}.csv"
    return PlainTextResponse(
        content="\ufeff" + csv_body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/tickets/export")
async def export_tickets_excel(
    current_user: User = Depends(require_staff()),
    db: AsyncSession = Depends(require_db),
) -> Response:
    """Export tickets visible to the current user as Excel (.xlsx)."""
    content = await build_tickets_export_xlsx(db, current_user)
    filename = "stardesk-sager.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
