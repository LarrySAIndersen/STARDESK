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


async def _schema_has_column(
    engine: AsyncEngine,
    column_name: str,
    *,
    table_name: str = "tickets",
) -> bool:
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = :table_name
                  AND column_name = :column_name
                """
            ),
            {"table_name": table_name, "column_name": column_name},
        )
        return result.scalar() is not None


async def _table_exists(engine: AsyncEngine, table_name: str) -> bool:
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                """
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = :table_name
                """
            ),
            {"table_name": table_name},
        )
        return result.scalar() is not None


_REQUIRED_TICKET_COLUMNS = (
    "organization_id",
    "is_major",
    "gdpr_consent",
    "assigned_at",
    "tags",
    "semantic_topics",
    "parent_ticket_id",
    "is_shared",
    "is_security_ticket",
    "routing_metadata",
    "is_knowledge_article",
    "knowledge_status",
    "knowledge_visibility",
)


async def _schema_needs_migration(engine: AsyncEngine) -> bool:
    """True when bundled SQL migrations should run (detail/list depend on these)."""
    for column in _REQUIRED_TICKET_COLUMNS:
        if not await _schema_has_column(engine, column):
            return True
    if not await _schema_has_column(engine, "scan_status", table_name="attachments"):
        return True
    if not await _table_exists(engine, "comment_reactions"):
        return True
    if not await _table_exists(engine, "ticket_links"):
        return True
    if not await _schema_has_column(engine, "must_change_password", table_name="users"):
        return True
    if not await _schema_has_column(engine, "avatar_url", table_name="users"):
        return True
    if not await _schema_has_column(engine, "avatar_preset_id", table_name="users"):
        return True
    if not await _schema_has_column(engine, "password_policy_exempt", table_name="users"):
        return True
    if not await _table_exists(engine, "organization_integrations"):
        return True
    if not await _table_exists(engine, "email_integrations"):
        return True
    if not await _table_exists(engine, "ticket_emails"):
        return True
    if not await _table_exists(engine, "sf_chat_sessions"):
        return True
    if not await _schema_has_column(engine, "is_system", table_name="sf_chat_messages"):
        return True
    if not await _table_exists(engine, "cmdb_catalog"):
        return True
    if not await _table_exists(engine, "cmdb_audit_log"):
        return True
    if not await _table_exists(engine, "kanban_boards"):
        return True
    if not await _table_exists(engine, "kanban_board_tickets"):
        return True
    return False


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


async def _needs_ticket_source_chat_migration(engine: AsyncEngine) -> bool:
    """True when tickets.source CHECK must be widened to allow chat (and knowledge)."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                """
                SELECT pg_get_constraintdef(c.oid) AS def
                FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public'
                  AND t.relname = 'tickets'
                  AND c.conname = 'tickets_source_check'
                """
            )
        )
        row = result.fetchone()
        if row is None or row[0] is None:
            return False
        return "chat" not in str(row[0]).lower()


async def ensure_ticket_schema_current(
    engine: AsyncEngine | None,
    database_url: str | None,
) -> None:
    """Run bundled idempotent migrations when ticket columns are missing."""
    if engine is None or not database_url:
        return
    try:
        if await _schema_needs_migration(engine):
            logger.warning("Database schema outdated — applying SQL migrations")
            await asyncio.to_thread(_run_migrations, database_url)
            if await _schema_needs_migration(engine):
                logger.error("Schema sync finished but required tables/columns are still missing")
            else:
                logger.info("Database schema sync completed")
        if await _needs_sf_groups_migration(engine):
            logger.warning("SF group names outdated — applying SF group migrations")
            await asyncio.to_thread(_run_single_migration, database_url, "13_sf-groups-rename-migration.sql")
            await asyncio.to_thread(
                _run_single_migration, database_url, "14_sf-operations-master-group.sql"
            )
        if await _needs_ticket_source_chat_migration(engine):
            logger.warning("tickets.source constraint outdated — applying ticket source migration")
            await asyncio.to_thread(_run_single_migration, database_url, "22_ticket-source-chat.sql")
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
