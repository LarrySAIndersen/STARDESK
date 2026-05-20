from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import require_admin
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.admin import SlaResetResponse
from star_itsm_api.schemas.category_admin import (
    CategoryAdminRead,
    CategoryCreate,
    CategoryFillTicketsResult,
    CategorySyncResult,
    CategoryUpdate,
    SubcategoryAdminRead,
    SubcategoryCreate,
    SubcategoryUpdate,
)
from star_itsm_api.schemas.sla_admin import SlaPolicyRead, SlaPolicyUpdate, SlaStandardRuleRead
from star_itsm_api.services.category_admin import (
    create_category,
    create_subcategory,
    list_categories_admin,
    sync_default_categories,
    update_category,
    update_subcategory,
)
from star_itsm_api.services.category_bulk_assign import fill_tickets_missing_category
from star_itsm_api.services.permissions import can_manage_users
from star_itsm_api.services.sla_admin import (
    list_sla_policies,
    list_standard_sla_rules,
    update_sla_policy,
)
from star_itsm_api.services.sla_reset import reset_all_ticket_sla

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/reset-sla", response_model=SlaResetResponse)
async def reset_sla(
    dry_run: bool = Query(
        default=False,
        description="Tæl berørte sager uden at gemme ændringer",
    ),
    anchor: Literal["created_at", "now"] = Query(
        default="created_at",
        description=(
            "created_at: genberegn fra sagens oprettelsestidspunkt (som ved prioritetsændring); "
            "now: nye frister fra nu"
        ),
    ),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> SlaResetResponse:
    if not can_manage_users(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kun administratorer kan nulstille SLA for alle sager",
        )

    result = await reset_all_ticket_sla(db, anchor=anchor, dry_run=dry_run)
    return SlaResetResponse(
        ticket_count=result.ticket_count,
        updated_count=result.updated_count,
        dry_run=result.dry_run,
        anchor=result.anchor,
    )


@router.get("/sla/policies", response_model=list[SlaPolicyRead])
async def get_sla_policies(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> list[SlaPolicyRead]:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return await list_sla_policies(db)


@router.get("/sla/standard-rules", response_model=list[SlaStandardRuleRead])
async def get_sla_standard_rules(
    current_user: User = Depends(require_admin()),
) -> list[SlaStandardRuleRead]:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return list_standard_sla_rules()


@router.patch("/sla/policies/{policy_id}", response_model=SlaPolicyRead)
async def patch_sla_policy(
    policy_id: UUID,
    payload: SlaPolicyUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> SlaPolicyRead:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return await update_sla_policy(db, policy_id, payload)


@router.get("/categories", response_model=list[CategoryAdminRead])
async def get_admin_categories(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> list[CategoryAdminRead]:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return await list_categories_admin(db)


@router.post("/categories", response_model=CategoryAdminRead, status_code=status.HTTP_201_CREATED)
async def post_admin_category(
    payload: CategoryCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> CategoryAdminRead:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return await create_category(db, payload)


@router.patch("/categories/{category_id}", response_model=CategoryAdminRead)
async def patch_admin_category(
    category_id: UUID,
    payload: CategoryUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> CategoryAdminRead:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return await update_category(db, category_id, payload)


@router.post("/categories/subcategories", response_model=SubcategoryAdminRead, status_code=status.HTTP_201_CREATED)
async def post_admin_subcategory(
    payload: SubcategoryCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> SubcategoryAdminRead:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return await create_subcategory(db, payload)


@router.patch("/categories/subcategories/{subcategory_id}", response_model=SubcategoryAdminRead)
async def patch_admin_subcategory(
    subcategory_id: UUID,
    payload: SubcategoryUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> SubcategoryAdminRead:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return await update_subcategory(db, subcategory_id, payload)


@router.post("/categories/sync-defaults", response_model=CategorySyncResult)
async def post_sync_default_categories(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> CategorySyncResult:
    if not can_manage_users(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    result = await sync_default_categories(db)
    return CategorySyncResult(
        categories_created=result.categories_created,
        subcategories_created=result.subcategories_created,
        categories_total=result.categories_total,
    )


@router.post("/categories/fill-tickets", response_model=CategoryFillTicketsResult)
async def post_fill_ticket_categories(
    dry_run: bool = Query(default=False, description="Tæl sager uden at gemme"),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> CategoryFillTicketsResult:
    if not can_manage_users(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kun administratorer kan udfylde kategorier på sager",
        )
    result = await fill_tickets_missing_category(db, dry_run=dry_run)
    return CategoryFillTicketsResult(
        ticket_count=result.ticket_count,
        updated_count=result.updated_count,
        dry_run=result.dry_run,
        category_name=result.category_name,
        subcategory_name=result.subcategory_name,
    )
