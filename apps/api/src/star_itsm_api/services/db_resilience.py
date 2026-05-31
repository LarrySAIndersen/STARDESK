"""Helpers for optional DB reads that must not poison the request session."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def rollback_session(db: AsyncSession) -> None:
    """Reset the session after a caught DB error so later queries can proceed."""
    try:
        await db.rollback()
    except Exception:
        logger.exception("Could not rollback database session after optional query failure")


async def optional_db_read[T](
    db: AsyncSession,
    operation: Callable[[], Awaitable[T]],
    *,
    default: T,
    log_message: str,
) -> T:
    """Run a read-only optional query in a savepoint so failures do not abort the session."""
    try:
        async with db.begin_nested():
            return await operation()
    except Exception:
        logger.warning(log_message, exc_info=True)
        return default
