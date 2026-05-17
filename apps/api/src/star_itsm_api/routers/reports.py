from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import ROLE_ADMIN, ROLE_AGENT, get_current_user, require_roles
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.report import StandardReportRead
from star_itsm_api.services.reports import build_standard_report, report_to_csv

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/standard", response_model=StandardReportRead)
async def get_standard_report(
    period_days: int | None = Query(default=30, ge=0, le=365),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_roles(ROLE_AGENT, ROLE_ADMIN)),
) -> StandardReportRead:
    days = period_days if period_days and period_days > 0 else None
    return await build_standard_report(db, current_user, period_days=days)


@router.get("/standard/export")
async def export_standard_report(
    bucket: str | None = Query(default=None, description="modtaget, igangsat, lost, lukket, genaabnet"),
    period_days: int | None = Query(default=30, ge=0, le=365),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_roles(ROLE_AGENT, ROLE_ADMIN)),
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
