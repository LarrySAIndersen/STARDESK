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


async def _needs_sf_groups_migration(engine: AsyncEngine) -> bool:
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                """
                SELECT 1
                FROM teams
                WHERE name IN (
                    'Infrastruktur',
                    'Service Desk',
                    'SF Chest',
                    'Es Trifft',
                    'SF A North Star Series'
                )
                  AND is_active = TRUE
                LIMIT 1
                """
            )
        )
        if result.scalar() is not None:
            return True
        result = await conn.execute(
            text(
                """
                SELECT 1
                FROM teams t
                WHERE t.name = 'SF'
                  AND (
                      EXISTS (SELECT 1 FROM organizations WHERE name = 'SF Chest')
                      OR EXISTS (
                          SELECT 1 FROM users u
                          WHERE u.email = 'sfchest01@example.dk'
                            AND u.display_name LIKE 'SF Chest%'
                            AND u.deleted_at IS NULL
                      )
                      OR (
                          SELECT COUNT(*) FROM team_members tm
                          WHERE tm.team_id = t.id
                      ) > 6
                  )
                LIMIT 1
                """
            )
        )
        return result.scalar() is not None


async def ensure_ticket_schema_current(
    engine: AsyncEngine | None,
    database_url: str | None,
) -> None:
    """Run bundled idempotent migrations when ticket columns are missing."""
    if engine is None or not database_url:
        return
    try:
        if not await _schema_has_column(engine, "is_security_ticket"):
            logger.warning("Ticket schema outdated — applying SQL migrations")
            await asyncio.to_thread(_run_migrations, database_url)
            if await _schema_has_column(engine, "is_security_ticket"):
                logger.info("Ticket schema sync completed")
            else:
                logger.error("Ticket schema sync finished but is_security_ticket still missing")
        if await _needs_sf_groups_migration(engine):
            logger.warning("SF group names outdated — applying SF group migrations")
            await asyncio.to_thread(_run_single_migration, database_url, "13_sf-groups-rename-migration.sql")
            await asyncio.to_thread(
                _run_single_migration, database_url, "14_sf-operations-master-group.sql"
            )
    except Exception:
        logger.exception("Schema sync failed — some endpoints may return 500")


def _run_single_migration(database_url: str, filename: str) -> None:
    path = Path(__file__).resolve().parent.joinpath("sql", "migrations", filename)
    if not path.is_file():
        logger.error("Migration file missing: %s", filename)
        return
    dsn = _sync_database_url(database_url)
    sql = path.read_text(encoding="utf-8")
    with psycopg.connect(dsn, autocommit=False) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()
            logger.info("Applied migration %s", filename)
        except Exception as exc:
            conn.rollback()
            logger.warning("Migration %s failed: %s", filename, exc)
