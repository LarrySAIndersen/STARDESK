from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.deps import require_db
from star_itsm_api.models.category import Category, Subcategory
from star_itsm_api.schemas.category import CategoryRead, SubcategoryRead

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
async def list_categories(db: AsyncSession = Depends(require_db)) -> list[CategoryRead]:
    categories = (
        await db.execute(
            select(Category)
            .where(Category.is_active.is_(True))
            .order_by(Category.sort_order.asc())
        )
    ).scalars().all()

    subcategories = (
        await db.execute(
            select(Subcategory)
            .where(Subcategory.is_active.is_(True))
            .order_by(Subcategory.sort_order.asc())
        )
    ).scalars().all()

    subs_by_category: dict = {}
    for sub in subcategories:
        subs_by_category.setdefault(sub.category_id, []).append(
            SubcategoryRead.model_validate(sub)
        )

    return [
        CategoryRead(
            id=category.id,
            name=category.name,
            name_da=category.name_da,
            subcategories=subs_by_category.get(category.id, []),
        )
        for category in categories
    ]
