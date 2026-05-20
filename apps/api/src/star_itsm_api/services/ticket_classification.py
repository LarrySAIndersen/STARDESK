import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.category import Category, Subcategory
from star_itsm_api.services.ticket_source import TICKET_SOURCES_DB


async def validate_ticket_classification(
    db: AsyncSession,
    *,
    category_id: uuid.UUID | None,
    subcategory_id: uuid.UUID | None,
) -> None:
    if subcategory_id is not None and category_id is None:
        raise HTTPException(
            status_code=400,
            detail="Vælg kategori før underkategori",
        )
    if category_id is not None:
        category = await db.get(Category, category_id)
        if category is None or not category.is_active:
            raise HTTPException(status_code=400, detail="Ugyldig kategori")
    if subcategory_id is not None:
        subcategory = await db.get(Subcategory, subcategory_id)
        if (
            subcategory is None
            or not subcategory.is_active
            or subcategory.category_id != category_id
        ):
            raise HTTPException(status_code=400, detail="Ugyldig underkategori")


def validate_ticket_source_value(source: str) -> None:
    if source not in TICKET_SOURCES_DB:
        raise HTTPException(status_code=400, detail="Ugyldig kilde")
