"""Unit tests for star_itsm_api.services.user_tickets (service-level, mocked DB)."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.schemas.ticket import TicketRead
from star_itsm_api.services import user_tickets


def _ticket_read() -> TicketRead:
    return TicketRead(
        id=uuid.uuid4(),
        ticket_number="INC-1001",
        title="Test sag",
        status="new",
        priority="medium",
        ticket_type="incident",
        created_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_tickets_for_ids_empty_returns_empty() -> None:
    db = AsyncMock()
    result = await user_tickets._tickets_for_ids(db, [], limit=10)
    assert result == []
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_tickets_for_ids_dedup_and_query() -> None:
    db = AsyncMock()
    exec_result = MagicMock()
    exec_result.scalars.return_value.all.return_value = [SimpleNamespace(), SimpleNamespace()]
    db.execute = AsyncMock(return_value=exec_result)
    reads = [_ticket_read()]
    dup_id = uuid.uuid4()
    with patch.object(
        user_tickets, "tickets_to_read_list", new=AsyncMock(return_value=reads)
    ) as conv:
        out = await user_tickets._tickets_for_ids(
            db, [dup_id, dup_id, uuid.uuid4()], limit=10
        )
    assert out == reads
    db.execute.assert_awaited_once()
    conv.assert_awaited_once()


@pytest.mark.asyncio
async def test_ticket_ids_by_stakeholder_role_success() -> None:
    db = AsyncMock()
    id1, id2 = uuid.uuid4(), uuid.uuid4()
    exec_result = MagicMock()
    exec_result.all.return_value = [(id1,), (id2,)]
    db.execute = AsyncMock(return_value=exec_result)
    out = await user_tickets._ticket_ids_by_stakeholder_role(
        db, user_id=uuid.uuid4(), role="affected", limit=10
    )
    assert out == [id1, id2]


@pytest.mark.asyncio
async def test_ticket_ids_by_stakeholder_role_error_returns_empty() -> None:
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=RuntimeError("boom"))
    with patch.object(user_tickets, "rollback_session", new=AsyncMock()) as rb:
        out = await user_tickets._ticket_ids_by_stakeholder_role(
            db, user_id=uuid.uuid4(), role="affected", limit=10
        )
    assert out == []
    rb.assert_awaited_once_with(db)


@pytest.mark.asyncio
async def test_list_user_tickets_grouped_orchestration() -> None:
    db = AsyncMock()
    reported_result = MagicMock()
    reported_result.all.return_value = [(uuid.uuid4(),)]
    assigned_result = MagicMock()
    assigned_result.all.return_value = [(uuid.uuid4(),)]
    db.execute = AsyncMock(side_effect=[reported_result, assigned_result])
    reads = [_ticket_read()]
    with (
        patch.object(
            user_tickets,
            "_ticket_ids_by_stakeholder_role",
            new=AsyncMock(return_value=[uuid.uuid4()]),
        ),
        patch.object(
            user_tickets, "_tickets_for_ids", new=AsyncMock(return_value=reads)
        ),
    ):
        grouped = await user_tickets.list_user_tickets_grouped(
            db, user_id=uuid.uuid4(), limit=50
        )
    assert grouped.reported == reads
    assert grouped.assigned == reads
    assert grouped.affected == reads
    assert grouped.interested == reads
    assert grouped.mentioned == reads


@pytest.mark.asyncio
@pytest.mark.parametrize("limit", [0, 1000])
async def test_list_user_tickets_grouped_clamps_limit(limit: int) -> None:
    db = AsyncMock()
    reported_result = MagicMock()
    reported_result.all.return_value = []
    assigned_result = MagicMock()
    assigned_result.all.return_value = []
    db.execute = AsyncMock(side_effect=[reported_result, assigned_result])
    with (
        patch.object(
            user_tickets,
            "_ticket_ids_by_stakeholder_role",
            new=AsyncMock(return_value=[]),
        ),
        patch.object(user_tickets, "_tickets_for_ids", new=AsyncMock(return_value=[])),
    ):
        grouped = await user_tickets.list_user_tickets_grouped(
            db, user_id=uuid.uuid4(), limit=limit
        )
    assert grouped.reported == []
