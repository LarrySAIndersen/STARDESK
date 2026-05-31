import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import require_staff
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.workboard import (
    WorkboardBulkImportRequest,
    WorkboardBulkImportResult,
    WorkboardTaskCreate,
    WorkboardTaskRead,
    WorkboardTaskUpdate,
)
from star_itsm_api.services import workboard_service

router = APIRouter(prefix="/workboard", tags=["workboard"])


@router.get("/tasks")
async def list_tasks(
    status: str | None = Query(default=None, description="Filter by kanban status"),
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(require_staff()),
) -> list[WorkboardTaskRead]:
    return await workboard_service.list_tasks(db, status=status)


@router.get("/tasks/export")
async def export_tasks(
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(require_staff()),
) -> list[dict]:
    """Full canvas-compatible export for recovery / sidecar sync."""
    return await workboard_service.export_all_tasks(db)


@router.get("/tasks/by-number/{number}")
async def get_task_by_number(
    number: int,
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(require_staff()),
) -> WorkboardTaskRead:
    try:
        return await workboard_service.get_task_by_number(db, number)
    except LookupError:
        raise HTTPException(status_code=404, detail="Opgave ikke fundet") from None


@router.get("/tasks/{task_ref}")
async def get_task(
    task_ref: str,
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(require_staff()),
) -> WorkboardTaskRead:
    try:
        parsed = uuid.UUID(task_ref)
    except ValueError:
        try:
            return await workboard_service.get_task_by_canvas_id(db, task_ref)
        except LookupError:
            raise HTTPException(status_code=404, detail="Opgave ikke fundet") from None
    try:
        return await workboard_service.get_task_by_uuid(db, parsed)
    except LookupError:
        raise HTTPException(status_code=404, detail="Opgave ikke fundet") from None


@router.post("/tasks", status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: WorkboardTaskCreate,
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(require_staff()),
) -> WorkboardTaskRead:
    try:
        return await workboard_service.create_task(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.patch("/tasks/{task_ref}")
async def update_task(
    task_ref: str,
    payload: WorkboardTaskUpdate,
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(require_staff()),
) -> WorkboardTaskRead:
    try:
        parsed = uuid.UUID(task_ref)
        return await workboard_service.update_task(db, task_id=parsed, payload=payload)
    except ValueError:
        try:
            return await workboard_service.update_task(db, canvas_id=task_ref, payload=payload)
        except LookupError:
            raise HTTPException(status_code=404, detail="Opgave ikke fundet") from None


@router.put("/tasks/{canvas_id}")
async def upsert_task_from_canvas(
    canvas_id: str,
    body: dict,
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(require_staff()),
) -> WorkboardTaskRead:
    """Full merge from canvas-shaped JSON (used by sidecar sync)."""
    raw = {**body, "id": canvas_id}
    try:
        return await workboard_service.patch_task_from_canvas_dict(db, raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/tasks/bulk-import")
async def bulk_import_tasks(
    payload: WorkboardBulkImportRequest,
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(require_staff()),
) -> WorkboardBulkImportResult:
    return await workboard_service.bulk_import(
        db,
        payload.tasks,
        replace_missing=payload.replace_missing,
    )
