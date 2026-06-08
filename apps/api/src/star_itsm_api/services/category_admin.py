from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.category import Category, Subcategory
from star_itsm_api.schemas.category_admin import (
    CategoryAdminRead,
    CategoryCreate,
    CategoryUpdate,
    SubcategoryAdminRead,
    SubcategoryCreate,
    SubcategoryUpdate,
)
from star_itsm_api.services.category_defaults import DEFAULT_CATEGORIES


@dataclass(frozen=True)
class CategorySyncCounts:
    categories_created: int
    subcategories_created: int
    categories_total: int


async def list_categories_admin(db: AsyncSession) -> list[CategoryAdminRead]:
    categories = (
        (
            await db.execute(
                select(Category).order_by(Category.sort_order.asc(), Category.name_da.asc())
            )
        )
        .scalars()
        .all()
    )
    subcategories = (
        (
            await db.execute(
                select(Subcategory).order_by(
                    Subcategory.sort_order.asc(), Subcategory.name_da.asc()
                )
            )
        )
        .scalars()
        .all()
    )
    subs_by_cat: dict[uuid.UUID, list[SubcategoryAdminRead]] = {}
    for sub in subcategories:
        subs_by_cat.setdefault(sub.category_id, []).append(
            SubcategoryAdminRead(
                id=sub.id,
                category_id=sub.category_id,
                name=sub.name,
                name_da=sub.name_da,
                sort_order=sub.sort_order,
                is_active=sub.is_active,
            )
        )
    return [
        CategoryAdminRead(
            id=c.id,
            name=c.name,
            name_da=c.name_da,
            sort_order=c.sort_order,
            is_active=c.is_active,
            subcategories=subs_by_cat.get(c.id, []),
        )
        for c in categories
    ]


async def create_category(db: AsyncSession, payload: CategoryCreate) -> CategoryAdminRead:
    existing = (
        await db.execute(select(Category).where(Category.name == payload.name))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Kategori med navn '{payload.name}' findes allerede",
        )
    row = Category(
        id=uuid.uuid4(),
        name=payload.name,
        name_da=payload.name_da,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return CategoryAdminRead(
        id=row.id,
        name=row.name,
        name_da=row.name_da,
        sort_order=row.sort_order,
        is_active=row.is_active,
        subcategories=[],
    )


async def update_category(
    db: AsyncSession,
    category_id: uuid.UUID,
    payload: CategoryUpdate,
) -> CategoryAdminRead:
    row = await db.get(Category, category_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kategori ikke fundet")
    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] != row.name:
        clash = (
            await db.execute(select(Category).where(Category.name == updates["name"]))
        ).scalar_one_or_none()
        if clash is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Kategorinavn er optaget"
            )
    for key, value in updates.items():
        setattr(row, key, value)
    await db.commit()
    await db.refresh(row)
    all_cats = await list_categories_admin(db)
    match = next((c for c in all_cats if c.id == row.id), None)
    if match is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Kategori mangler efter gem"
        )
    return match


async def create_subcategory(db: AsyncSession, payload: SubcategoryCreate) -> SubcategoryAdminRead:
    category = await db.get(Category, payload.category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kategori ikke fundet")
    clash = (
        await db.execute(
            select(Subcategory).where(
                Subcategory.category_id == payload.category_id,
                Subcategory.name == payload.name,
            )
        )
    ).scalar_one_or_none()
    if clash is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Underkategori med dette tekniske navn findes allerede på kategorien",
        )
    row = Subcategory(
        id=uuid.uuid4(),
        category_id=payload.category_id,
        name=payload.name,
        name_da=payload.name_da,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return SubcategoryAdminRead(
        id=row.id,
        category_id=row.category_id,
        name=row.name,
        name_da=row.name_da,
        sort_order=row.sort_order,
        is_active=row.is_active,
    )


async def update_subcategory(
    db: AsyncSession,
    subcategory_id: uuid.UUID,
    payload: SubcategoryUpdate,
) -> SubcategoryAdminRead:
    row = await db.get(Subcategory, subcategory_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Underkategori ikke fundet"
        )
    updates = payload.model_dump(exclude_unset=True)
    new_name = updates.get("name")
    if new_name is not None and new_name != row.name:
        clash = (
            await db.execute(
                select(Subcategory).where(
                    Subcategory.category_id == row.category_id,
                    Subcategory.name == new_name,
                )
            )
        ).scalar_one_or_none()
        if clash is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Underkategorinavn er optaget"
            )
    for key, value in updates.items():
        setattr(row, key, value)
    await db.commit()
    await db.refresh(row)
    return SubcategoryAdminRead(
        id=row.id,
        category_id=row.category_id,
        name=row.name,
        name_da=row.name_da,
        sort_order=row.sort_order,
        is_active=row.is_active,
    )


async def _ensure_category_row(db: AsyncSession, spec) -> tuple[Category, bool]:
    row = (await db.execute(select(Category).where(Category.name == spec.name))).scalar_one_or_none()
    if row is None:
        row = Category(
            id=uuid.uuid4(),
            name=spec.name,
            name_da=spec.name_da,
            sort_order=spec.sort_order,
            is_active=True,
        )
        db.add(row)
        await db.flush()
        return row, True
    row.name_da = spec.name_da
    row.sort_order = spec.sort_order
    if not row.is_active:
        row.is_active = True
    return row, False


async def _sync_subcategory_spec(db: AsyncSession, row: Category, sub_spec) -> bool:
    sub = (
        await db.execute(
            select(Subcategory).where(
                Subcategory.category_id == row.id,
                Subcategory.name == sub_spec.name,
            )
        )
    ).scalar_one_or_none()
    if sub is None:
        db.add(
            Subcategory(
                id=uuid.uuid4(),
                category_id=row.id,
                name=sub_spec.name,
                name_da=sub_spec.name_da,
                sort_order=sub_spec.sort_order,
                is_active=True,
            )
        )
        return True
    sub.name_da = sub_spec.name_da
    sub.sort_order = sub_spec.sort_order
    if not sub.is_active:
        sub.is_active = True
    return False


async def sync_default_categories(db: AsyncSession) -> CategorySyncCounts:
    categories_created = 0
    subcategories_created = 0

    for spec in DEFAULT_CATEGORIES:
        row, created = await _ensure_category_row(db, spec)
        if created:
            categories_created += 1
        for sub_spec in spec.subcategories:
            if await _sync_subcategory_spec(db, row, sub_spec):
                subcategories_created += 1

    await db.commit()
    total = len((await db.execute(select(Category))).scalars().all())
    return CategorySyncCounts(
        categories_created=categories_created,
        subcategories_created=subcategories_created,
        categories_total=total,
    )
