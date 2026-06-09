"""Apply idempotent SQL migrations on startup when ticket schema is behind the ORM."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import psycopg
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger(__name__)

MIGRATION_FILES = sorted(
    Path(__file__).resolve().parent.joinpath("sql", "migrations").glob("*.sql")
)


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


_REQUIRED_PERSONAL_NOTE_COLUMNS = (
    "note_number",
    "board_x",
    "board_y",
    "category",
    "ticket_id",
    "visibility",
)

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

    required_columns = [
        ("attachments", "scan_status"),
        ("users", "must_change_password"),
        ("users", "avatar_url"),
        ("users", "avatar_preset_id"),
        ("users", "password_policy_exempt"),
        ("sf_chat_messages", "is_system"),
    ]
    for table, column in required_columns:
        if not await _schema_has_column(engine, column, table_name=table):
            return True

    required_tables = [
        "comment_reactions",
        "ticket_links",
        "ticket_stakeholders",
        "entity_relationships",
        "organization_integrations",
        "email_integrations",
        "ticket_emails",
        "sf_chat_sessions",
        "cmdb_catalog",
        "cmdb_audit_log",
        "kanban_boards",
        "kanban_board_tickets",
    ]
    for table in required_tables:
        if not await _table_exists(engine, table):
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


async def _personal_notes_schema_needs_migration(engine: AsyncEngine) -> bool:
    if not await _table_exists(engine, "personal_notes"):
        return True
    for column in _REQUIRED_PERSONAL_NOTE_COLUMNS:
        if not await _schema_has_column(engine, column, table_name="personal_notes"):
            return True
    return False


async def ensure_personal_notes_schema_current(
    engine: AsyncEngine | None,
    database_url: str | None,
) -> None:
    """Apply idempotent personal_notes columns when Alembic was not run (e.g. staging)."""
    if engine is None or not database_url:
        return
    try:
        if await _personal_notes_schema_needs_migration(engine):
            logger.warning("personal_notes schema outdated — applying SQL migration")
            await asyncio.to_thread(
                _run_single_migration,
                database_url,
                "33_personal-notes-schema-migration.sql",
            )
            if await _personal_notes_schema_needs_migration(engine):
                logger.error(
                    "personal_notes schema sync finished but required columns are still missing"
                )
            else:
                logger.info("personal_notes schema sync completed")
    except Exception:
        logger.exception("personal_notes schema sync failed — notes endpoints may return 500")


async def _role_constraints_include_kundeportal_2(engine: AsyncEngine) -> bool:
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                """
                SELECT pg_get_constraintdef(c.oid)
                FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                WHERE t.relname = 'user_roles'
                  AND c.conname = 'user_roles_role_check'
                """
            )
        )
        row = result.fetchone()
        if row is None or row[0] is None:
            return False
        return "kundeportal_2" in str(row[0])


async def ensure_kundeportal_2_role_current(
    engine: AsyncEngine | None,
    database_url: str | None,
) -> None:
    """Apply kundeportal_2 role constraints when Alembic migration did not run."""
    if engine is None or not database_url:
        return
    try:
        if await _role_constraints_include_kundeportal_2(engine):
            return
        logger.warning("user_roles missing kundeportal_2 — applying SQL migration")
        await asyncio.to_thread(
            _run_single_migration,
            database_url,
            "34_kundeportal-2-role-migration.sql",
        )
        if await _role_constraints_include_kundeportal_2(engine):
            logger.info("kundeportal_2 role constraint sync completed")
        else:
            logger.error(
                "kundeportal_2 role sync finished but user_roles_role_check is still outdated"
            )
    except Exception:
        logger.exception(
            "kundeportal_2 role sync failed — assigning Kundeportal #2 may return 500"
        )


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
            await asyncio.to_thread(
                _run_single_migration, database_url, "13_sf-groups-rename-migration.sql"
            )
            await asyncio.to_thread(
                _run_single_migration, database_url, "14_sf-operations-master-group.sql"
            )
        if await _needs_ticket_source_chat_migration(engine):
            logger.warning("tickets.source constraint outdated — applying ticket source migration")
            await asyncio.to_thread(
                _run_single_migration, database_url, "22_ticket-source-chat.sql"
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
