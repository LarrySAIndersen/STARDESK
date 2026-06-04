from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.db import get_db


def require_db(
    db: AsyncSession | None = Depends(get_db),
) -> AsyncSession:
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Database is not configured",
        )
    return db
