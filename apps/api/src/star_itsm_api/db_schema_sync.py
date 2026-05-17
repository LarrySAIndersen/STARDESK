"""Apply idempotent SQL migrations on startup when ticket schema is behind the ORM."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import psycopg
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger(__name__)

MIGRATION_FILES = sorted(Path(__file__).resolve().parent.joinpath("sql", "migrations").glob("*.sql"))


def _sync_database_url(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgres+asyncpg://",
        "postgres://",
    )


async def _schema_has_column(engine: AsyncEngine, column_name: str) -> bool:
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'tickets'
                  AND column_name = :column_name
                """
            ),
            {"column_name": column_name},
        )
        return result.scalar() is not None


def _run_migrations(database_url: str) -> None:
    dsn = _sync_database_url(database_url)
    with psycopg.connect(dsn, autocommit=False) as conn:
        for path in MIGRATION_FILES:
            sql = path.read_text(encoding="utf-8")
            try:
                with conn.cursor() as cur:
                    cur.execute(sql)
                conn.commit()
                logger.info("Applied migration %s", path.name)
            except Exception as exc:
                conn.rollback()
                logger.warning("Migration %s skipped: %s", path.name, exc)


async def ensure_ticket_schema_current(
    engine: AsyncEngine | None,
    database_url: str | None,
) -> None:
    """Run bundled idempotent migrations when ticket columns are missing."""
    if engine is None or not database_url:
        return
    try:
        if await _schema_has_column(engine, "is_security_ticket"):
            return
        logger.warning("Ticket schema outdated — applying SQL migrations")
        await asyncio.to_thread(_run_migrations, database_url)
        if await _schema_has_column(engine, "is_security_ticket"):
            logger.info("Ticket schema sync completed")
        else:
            logger.error("Ticket schema sync finished but is_security_ticket still missing")
    except Exception:
        logger.exception("Ticket schema sync failed — ticket/report endpoints may return 500")
