from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import get_current_user, is_staff, require_staff
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.recurring_task import (
    RecurringTaskCreate,
    RecurringTaskRead,
    RecurringTaskUpdate,
)
from star_itsm_api.services.recurring_tasks import (
    create_recurring_task,
    delete_recurring_task,
    list_recurring_tasks,
    update_recurring_task,
)

router = APIRouter(prefix="/recurring-tasks", tags=["recurring-tasks"])


@router.get("", response_model=list[RecurringTaskRead])
async def get_recurring_tasks(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> list[RecurringTaskRead]:
    _ = current_user
    return await list_recurring_tasks(db)


@router.post("", response_model=RecurringTaskRead, status_code=status.HTTP_201_CREATED)
async def post_recurring_task(
    payload: RecurringTaskCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> RecurringTaskRead:
    return await create_recurring_task(db, current_user=current_user, payload=payload)


@router.patch("/{task_id}", response_model=RecurringTaskRead)
async def patch_recurring_task(
    task_id: UUID,
    payload: RecurringTaskUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> RecurringTaskRead:
    _ = current_user
    return await update_recurring_task(db, task_id=task_id, payload=payload)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_recurring_task(
    task_id: UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> None:
    _ = current_user
    await delete_recurring_task(db, task_id=task_id)


@router.get("/auth-check")
async def recurring_tasks_auth_check(
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    return {"staff": is_staff(current_user)}
