"""Unit tests for CMDB audit log service."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.models.cmdb_audit_log import CmdbAuditLog
from star_itsm_api.schemas.cmdb import CmdbAuditCreate, CmdbAuditEntryRead
from star_itsm_api.services import cmdb_audit


def _actor() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        display_name="Anna Agent",
    )


def _audit_row(*, row_id: uuid.UUID | None = None, summary: str = "Test summary") -> CmdbAuditLog:
    now = datetime.now(UTC)
    return CmdbAuditLog(
        id=row_id or uuid.uuid4(),
        created_at=now,
        actor_user_id=uuid.uuid4(),
        actor_display_name="Anna Agent",
        action="update",
        entity_type="system",
        entity_id="sys-1",
        entity_label="CRM",
        changes={"name": {"old": "A", "new": "B"}},
        summary_da=summary,
        search_text="update system sys-1 crm anna agent test summary",
    )


def test_build_search_text_joins_lowercase_parts() -> None:
    text = cmdb_audit._build_search_text(
        action="Create",
        entity_type="System",
        entity_id="SYS-1",
        entity_label="Portal",
        actor_display_name="Jan",
        summary_da="Oprettede system",
    )
    assert "create" in text
    assert "portal" in text
    assert "jan" in text


def test_default_summary_da_uses_known_verbs() -> None:
    assert "oprettede" in cmdb_audit._default_summary_da(
        actor_display_name="Anna",
        action="create",
        entity_label="Firewall",
    )
    assert "ændrede" in cmdb_audit._default_summary_da(
        actor_display_name="Anna",
        action="unknown_action",
        entity_label="Switch",
    )


@pytest.mark.asyncio
async def test_append_audit_entry_generates_summary_when_missing() -> None:
    actor = _actor()
    mock_db = AsyncMock()
    payload = CmdbAuditCreate(
        action="delete",
        entity_type="edge",
        entity_id="edge-9",
        entity_label="Link A→B",
        summary_da="",
    )

    row = await cmdb_audit.append_audit_entry(mock_db, actor=actor, payload=payload)
    assert "slettede" in row.summary_da
    assert row.entity_label == "Link A→B"
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_list_audit_log_respects_byte_budget() -> None:
    mock_db = AsyncMock()
    rows = [_audit_row(summary=f"Entry {index}") for index in range(5)]
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = rows
    mock_db.execute = AsyncMock(return_value=mock_result)

    page = await cmdb_audit.list_audit_log(mock_db, byte_budget=200)
    assert len(page.items) < len(rows)
    assert page.has_more is True
    assert page.next_before_id == page.items[-1].id


@pytest.mark.asyncio
async def test_list_audit_log_with_search_and_before_id() -> None:
    anchor_id = uuid.uuid4()
    anchor = _audit_row(row_id=anchor_id)
    row = _audit_row()
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=anchor)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [row]
    mock_db.execute = AsyncMock(return_value=mock_result)

    page = await cmdb_audit.list_audit_log(
        mock_db,
        before_id=anchor_id,
        search="CRM",
        byte_budget=cmdb_audit.DEFAULT_BYTE_BUDGET,
    )
    assert len(page.items) == 1
    mock_db.get.assert_awaited_once_with(CmdbAuditLog, anchor_id)


def test_entry_bytes_counts_json_size() -> None:
    entry = CmdbAuditEntryRead(
        id=uuid.uuid4(),
        created_at=datetime.now(UTC),
        actor_user_id=uuid.uuid4(),
        actor_display_name="Anna",
        action="update",
        entity_type="system",
        entity_id="x",
        entity_label="X",
        changes={},
        summary_da="Summary",
    )
    assert cmdb_audit._entry_bytes(entry) > 0
