"""Sagstype catalog — defaults with optional platform_settings overlay."""

from __future__ import annotations

import logging
import re

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.constants import TICKET_TYPE_PREFIX
from star_itsm_api.models.platform_setting import PlatformSetting
from star_itsm_api.schemas.case_types import (
    CaseTypeCatalogRead,
    CaseTypeCatalogUpdate,
    CaseTypeEntry,
    IntegrationTicketStatus,
)

logger = logging.getLogger(__name__)

CASE_TYPE_CATALOG_KEY = "case_type_catalog"

_BUILTIN_STATUSES: list[IntegrationTicketStatus] = [
    "new",
    "assigned",
    "in_progress",
    "on_hold",
    "resolved",
    "closed",
    "cancelled",
]

DEFAULT_CASE_TYPES: tuple[CaseTypeEntry, ...] = (
    CaseTypeEntry(
        id="incident",
        label_da="Hændelse",
        prefix=TICKET_TYPE_PREFIX["incident"],
        description_da="Uventet afbrydelse eller fejl der skal løses hurtigt.",
        allowed_priorities=["critical", "high", "medium", "low"],
        allowed_statuses=_BUILTIN_STATUSES,
    ),
    CaseTypeEntry(
        id="service_request",
        label_da="Serviceanmodning",
        prefix=TICKET_TYPE_PREFIX["service_request"],
        description_da="Planlagt ændring eller anmodning om service.",
        allowed_priorities=["high", "medium", "low"],
        allowed_statuses=_BUILTIN_STATUSES,
    ),
    CaseTypeEntry(
        id="problem",
        label_da="Problem",
        prefix=TICKET_TYPE_PREFIX["problem"],
        description_da="Underliggende årsag til gentagne hændelser.",
        allowed_priorities=["high", "medium", "low"],
        allowed_statuses=_BUILTIN_STATUSES,
    ),
)

_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")


def _entry_from_raw(raw: object) -> CaseTypeEntry | None:
    if not isinstance(raw, dict):
        return None
    try:
        return CaseTypeEntry.model_validate(raw)
    except Exception:
        return None


def _normalize_catalog(
    entries: list[CaseTypeEntry],
    *,
    strict: bool = True,
) -> list[CaseTypeEntry]:
    if not entries:
        if strict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mindst én sagstype skal være konfigureret",
            )
        return list(DEFAULT_CASE_TYPES)
    enabled = [entry for entry in entries if entry.enabled]
    if not enabled:
        if strict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mindst én sagstype skal være aktiv (enabled)",
            )
        return list(DEFAULT_CASE_TYPES)
    ids = [entry.id for entry in entries]
    if len(set(ids)) != len(ids):
        if strict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sagstype-id skal være unikke",
            )
        return list(DEFAULT_CASE_TYPES)
    prefixes = [entry.prefix for entry in enabled]
    if len(set(prefixes)) != len(prefixes):
        if strict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aktive sagstyper skal have unikke præfikser",
            )
        return list(DEFAULT_CASE_TYPES)
    return entries


async def get_case_type_catalog(db: AsyncSession | None = None) -> CaseTypeCatalogRead:
    if db is None:
        return CaseTypeCatalogRead(items=list(DEFAULT_CASE_TYPES), source="defaults")
    try:
        row = await db.get(PlatformSetting, CASE_TYPE_CATALOG_KEY)
    except Exception:
        return CaseTypeCatalogRead(items=list(DEFAULT_CASE_TYPES), source="defaults")
    if row is None or not isinstance(row.value, list):
        return CaseTypeCatalogRead(items=list(DEFAULT_CASE_TYPES), source="defaults")
    parsed = [_entry_from_raw(item) for item in row.value]
    items = [item for item in parsed if item is not None]
    if not items:
        return CaseTypeCatalogRead(items=list(DEFAULT_CASE_TYPES), source="defaults")
    return CaseTypeCatalogRead(items=_normalize_catalog(items, strict=False), source="platform_settings")


def get_enabled_case_types(catalog: CaseTypeCatalogRead) -> list[CaseTypeEntry]:
    return [entry for entry in catalog.items if entry.enabled]


def get_case_type_prefix_map(catalog: CaseTypeCatalogRead) -> dict[str, str]:
    mapping = {entry.id: entry.prefix for entry in catalog.items if entry.enabled}
    for entry in DEFAULT_CASE_TYPES:
        mapping.setdefault(entry.id, entry.prefix)
    return mapping


def resolve_ticket_type_prefix(catalog: CaseTypeCatalogRead, ticket_type: str) -> str:
    prefixes = get_case_type_prefix_map(catalog)
    prefix = prefixes.get(ticket_type)
    if prefix is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ukendt eller inaktiv sagstype: {ticket_type}",
        )
    return prefix


async def validate_ticket_type_id(
    db: AsyncSession,
    ticket_type: str,
    *,
    must_be_enabled: bool = True,
) -> CaseTypeEntry:
    if not _ID_PATTERN.match(ticket_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ugyldigt sagstype-id",
        )
    catalog = await get_case_type_catalog(db)
    for entry in catalog.items:
        if entry.id == ticket_type:
            if must_be_enabled and not entry.enabled:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Sagstypen '{ticket_type}' er deaktiveret",
                )
            return entry
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Ukendt sagstype: {ticket_type}",
    )


async def _sync_ticket_type_constraints(db: AsyncSession, enabled_ids: list[str]) -> None:
    if not enabled_ids:
        return
    quoted = ", ".join(f"'{item}'" for item in enabled_ids)
    in_list = f"({quoted})"
    statements = [
        "ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_ticket_type_check",
        f"ALTER TABLE tickets ADD CONSTRAINT tickets_ticket_type_check "
        f"CHECK (ticket_type IN {in_list})",
        "ALTER TABLE sla_assignments DROP CONSTRAINT IF EXISTS sla_assignments_ticket_type_check",
        f"ALTER TABLE sla_assignments ADD CONSTRAINT sla_assignments_ticket_type_check "
        f"CHECK (ticket_type IS NULL OR ticket_type IN {in_list})",
    ]
    for stmt in statements:
        await db.execute(text(stmt))


async def set_case_type_catalog(
    db: AsyncSession,
    payload: CaseTypeCatalogUpdate,
) -> CaseTypeCatalogRead:
    items = _normalize_catalog(payload.items)
    enabled_ids = [entry.id for entry in items if entry.enabled]
    try:
        await _sync_ticket_type_constraints(db, enabled_ids)
    except Exception:
        logger.exception("Failed to sync ticket_type CHECK constraints")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Kunne ikke opdatere database-constraints for sagstyper",
        ) from None

    serialized = [entry.model_dump() for entry in items]
    row = await db.get(PlatformSetting, CASE_TYPE_CATALOG_KEY)
    if row is None:
        row = PlatformSetting(key=CASE_TYPE_CATALOG_KEY, value=serialized)
        db.add(row)
    else:
        row.value = serialized
    await db.commit()
    return CaseTypeCatalogRead(items=items, source="platform_settings")
