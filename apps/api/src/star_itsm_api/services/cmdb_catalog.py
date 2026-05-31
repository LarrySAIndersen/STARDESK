"""Singleton CMDB catalog row in PostgreSQL."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.cmdb_catalog import CmdbCatalog
from star_itsm_api.models.user import User
from star_itsm_api.schemas.cmdb import CmdbCatalogPayload, CmdbCatalogRead, CmdbCatalogWrite

CATALOG_ROW_ID = 1


async def get_catalog(db: AsyncSession) -> CmdbCatalogRead:
    row = await db.get(CmdbCatalog, CATALOG_ROW_ID)
    if row is None:
        return CmdbCatalogRead(payload=CmdbCatalogPayload(), updated_at=None)
    return CmdbCatalogRead(
        payload=CmdbCatalogPayload.model_validate(row.payload),
        updated_at=row.updated_at,
    )


async def save_catalog(
    db: AsyncSession,
    *,
    actor: User,
    body: CmdbCatalogWrite,
) -> CmdbCatalogRead:
    now = datetime.now(UTC)
    row = await db.get(CmdbCatalog, CATALOG_ROW_ID)
    if row is None:
        row = CmdbCatalog(
            id=CATALOG_ROW_ID,
            payload=body.payload.model_dump(),
            updated_at=now,
            updated_by=actor.id,
        )
        db.add(row)
    else:
        row.payload = body.payload.model_dump()
        row.updated_at = now
        row.updated_by = actor.id
    await db.commit()
    await db.refresh(row)
    return CmdbCatalogRead(
        payload=CmdbCatalogPayload.model_validate(row.payload),
        updated_at=row.updated_at,
    )
