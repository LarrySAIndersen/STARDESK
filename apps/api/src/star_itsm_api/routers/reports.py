from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import require_staff
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.dashboard import DashboardRead
from star_itsm_api.schemas.report import StandardReportRead
from star_itsm_api.services.dashboard import build_dashboard
from star_itsm_api.services.dashboard_scope import (
    default_dashboard_scope,
    parse_dashboard_scope,
)
from star_itsm_api.services.reports import build_standard_report, report_to_csv
from star_itsm_api.services.ticket_export import build_tickets_export_xlsx

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard", response_model=DashboardRead)
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


@router.get("/standard", response_model=StandardReportRead)
async def get_standard_report(
    period_days: int | None = Query(default=30, ge=0, le=365),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> StandardReportRead:
    days = period_days if period_days and period_days > 0 else None
    return await build_standard_report(db, current_user, period_days=days)


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
