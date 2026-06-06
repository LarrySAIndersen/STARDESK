import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_link import TicketLink
from star_itsm_api.services.ticket_hierarchy import (
    HierarchyValidationError,
    add_related_major_link,
    broadcast_comment_to_children,
    count_children,
    get_child_tickets,
    get_related_major_tickets,
    is_store_sag,
    load_parent_ticket,
    normalize_link_pair,
    remove_related_major_link,
    set_parent_ticket_id,
    tickets_to_summaries,
    validate_major_link,
    validate_parent_assignment,
)


def _ticket(
    *,
    ticket_id: uuid.UUID | None = None,
    is_major: bool = False,
    parent_ticket_id: uuid.UUID | None = None,
) -> Ticket:
    return Ticket(
        id=ticket_id or uuid.uuid4(),
        ticket_number="INC-0001",
        ticket_type="incident",
        title="Test",
        description="Test description long enough",
        status="new",
        priority="medium",
        reporter_user_id=uuid.uuid4(),
        source="portal",
        is_major=is_major,
        parent_ticket_id=parent_ticket_id,
        created_at=__import__("datetime").datetime.now(__import__("datetime").UTC),
    )


def test_normalize_link_pair_orders_ids() -> None:
    a = uuid.UUID("00000000-0000-0000-0000-000000000001")
    b = uuid.UUID("00000000-0000-0000-0000-000000000002")
    assert normalize_link_pair(a, b) == (a, b)
    assert normalize_link_pair(b, a) == (a, b)


def test_normalize_link_pair_rejects_self() -> None:
    ticket_id = uuid.uuid4()
    with pytest.raises(HierarchyValidationError):
        normalize_link_pair(ticket_id, ticket_id)


def test_validate_parent_assignment_accepts_valid_child() -> None:
    parent = _ticket(is_major=True)
    child = _ticket()
    validate_parent_assignment(ticket=child, parent=parent, child_count=0)


def test_validate_parent_assignment_rejects_non_major_parent() -> None:
    parent = _ticket(is_major=False)
    child = _ticket()
    with pytest.raises(HierarchyValidationError, match="store sag"):
        validate_parent_assignment(ticket=child, parent=parent, child_count=0)


def test_validate_parent_assignment_rejects_major_child() -> None:
    parent = _ticket(is_major=True)
    child = _ticket(is_major=True)
    with pytest.raises(HierarchyValidationError, match="Store sager"):
        validate_parent_assignment(ticket=child, parent=parent, child_count=0)


def test_validate_parent_assignment_rejects_nested_parent() -> None:
    grandparent_id = uuid.uuid4()
    parent = _ticket(is_major=True, parent_ticket_id=grandparent_id)
    child = _ticket()
    with pytest.raises(HierarchyValidationError, match="child ticket"):
        validate_parent_assignment(ticket=child, parent=parent, child_count=0)


def test_validate_parent_assignment_rejects_ticket_with_children() -> None:
    parent = _ticket(is_major=True)
    child = _ticket()
    with pytest.raises(HierarchyValidationError, match="child tickets"):
        validate_parent_assignment(ticket=child, parent=parent, child_count=2)


def test_validate_major_link_requires_store_sager() -> None:
    source = _ticket(is_major=True)
    target = _ticket(is_major=False)
    with pytest.raises(HierarchyValidationError, match="store sag"):
        validate_major_link(source=source, target=target)


def test_is_store_sag() -> None:
    assert is_store_sag(_ticket(is_major=True)) is True
    assert is_store_sag(_ticket(is_major=True, parent_ticket_id=uuid.uuid4())) is False
    assert is_store_sag(_ticket(is_major=False)) is False


def test_validate_parent_assignment_none_parent_is_noop() -> None:
    child = _ticket()
    validate_parent_assignment(ticket=child, parent=None, child_count=0)


def test_validate_parent_assignment_rejects_deleted_ticket() -> None:
    parent = _ticket(is_major=True)
    child = _ticket()
    child.deleted_at = datetime.now(UTC)
    with pytest.raises(HierarchyValidationError, match="deleted"):
        validate_parent_assignment(ticket=child, parent=parent, child_count=0)


def test_validate_parent_assignment_rejects_deleted_parent() -> None:
    parent = _ticket(is_major=True)
    parent.deleted_at = datetime.now(UTC)
    child = _ticket()
    with pytest.raises(HierarchyValidationError, match="Parent ticket not found"):
        validate_parent_assignment(ticket=child, parent=parent, child_count=0)


def test_validate_parent_assignment_rejects_self_parent() -> None:
    ticket_id = uuid.uuid4()
    parent = _ticket(ticket_id=ticket_id, is_major=True)
    child = _ticket(ticket_id=ticket_id)
    with pytest.raises(HierarchyValidationError, match="own parent"):
        validate_parent_assignment(ticket=child, parent=parent, child_count=0)


def test_validate_major_link_rejects_deleted_and_child() -> None:
    source = _ticket(is_major=True)
    source.deleted_at = datetime.now(UTC)
    target = _ticket(is_major=True)
    with pytest.raises(HierarchyValidationError, match="Source"):
        validate_major_link(source=source, target=target)

    source = _ticket(is_major=True)
    target = _ticket(is_major=True, parent_ticket_id=uuid.uuid4())
    with pytest.raises(HierarchyValidationError, match="child ticket"):
        validate_major_link(source=source, target=target)


def test_tickets_to_summaries() -> None:
    ticket = _ticket(is_major=True)
    summaries = tickets_to_summaries([ticket])
    assert len(summaries) == 1
    assert summaries[0].id == ticket.id
    assert summaries[0].ticket_number == ticket.ticket_number


@pytest.mark.asyncio
async def test_count_children() -> None:
    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = 3
    db.execute = AsyncMock(return_value=mock_result)
    assert await count_children(db, uuid.uuid4()) == 3


@pytest.mark.asyncio
async def test_load_parent_ticket() -> None:
    db = AsyncMock()
    assert await load_parent_ticket(db, None) is None

    parent_id = uuid.uuid4()
    parent = _ticket(ticket_id=parent_id, is_major=True)
    db.get = AsyncMock(return_value=parent)
    assert await load_parent_ticket(db, parent_id) == parent

    deleted = _ticket(ticket_id=parent_id, is_major=True)
    deleted.deleted_at = datetime.now(UTC)
    db.get = AsyncMock(return_value=deleted)
    assert await load_parent_ticket(db, parent_id) is None

    db.get = AsyncMock(return_value=None)
    assert await load_parent_ticket(db, parent_id) is None


@pytest.mark.asyncio
async def test_get_child_tickets() -> None:
    db = AsyncMock()
    child = _ticket()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [child]
    db.execute = AsyncMock(return_value=mock_result)
    children = await get_child_tickets(db, uuid.uuid4())
    assert children == [child]


@pytest.mark.asyncio
async def test_get_related_major_tickets() -> None:
    db = AsyncMock()
    related = _ticket(is_major=True)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [related]
    db.execute = AsyncMock(return_value=mock_result)
    rows = await get_related_major_tickets(db, uuid.uuid4())
    assert rows == [related]


@pytest.mark.asyncio
async def test_set_parent_ticket_id() -> None:
    db = AsyncMock()
    parent = _ticket(is_major=True)
    child = _ticket()
    parent_id = parent.id

    with patch(
        "star_itsm_api.services.ticket_hierarchy.count_children",
        new_callable=AsyncMock,
        return_value=0,
    ), patch(
        "star_itsm_api.services.ticket_hierarchy.load_parent_ticket",
        new_callable=AsyncMock,
        return_value=parent,
    ):
        await set_parent_ticket_id(db, child, parent_id)
    assert child.parent_ticket_id == parent_id


@pytest.mark.asyncio
async def test_set_parent_ticket_id_missing_parent_raises() -> None:
    db = AsyncMock()
    child = _ticket()
    with patch(
        "star_itsm_api.services.ticket_hierarchy.count_children",
        new_callable=AsyncMock,
        return_value=0,
    ), patch(
        "star_itsm_api.services.ticket_hierarchy.load_parent_ticket",
        new_callable=AsyncMock,
        return_value=None,
    ):
        with pytest.raises(HierarchyValidationError, match="Parent ticket not found"):
            await set_parent_ticket_id(db, child, uuid.uuid4())


@pytest.mark.asyncio
async def test_add_related_major_link_creates_link() -> None:
    db = AsyncMock()
    source = _ticket(is_major=True)
    target = _ticket(is_major=True)
    source_id = source.id
    target_id = target.id

    def _get(model, pk):
        if pk == source_id:
            return source
        if pk == target_id:
            return target
        return None

    db.get = AsyncMock(side_effect=_get)
    await add_related_major_link(db, ticket_id=source_id, related_ticket_id=target_id)
    db.add.assert_called_once()
    link = db.add.call_args.args[0]
    assert isinstance(link, TicketLink)
    assert link.link_type == "related"


@pytest.mark.asyncio
async def test_add_related_major_link_skips_existing() -> None:
    db = AsyncMock()
    source = _ticket(is_major=True)
    target = _ticket(is_major=True)
    existing = TicketLink(
        from_ticket_id=min(source.id, target.id),
        to_ticket_id=max(source.id, target.id),
        link_type="related",
        created_at=datetime.now(UTC),
    )

    def _get(model, pk):
        if isinstance(pk, dict):
            return existing
        if pk == source.id:
            return source
        if pk == target.id:
            return target
        return None

    db.get = AsyncMock(side_effect=_get)
    await add_related_major_link(db, ticket_id=source.id, related_ticket_id=target.id)
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_add_related_major_link_missing_ticket_raises() -> None:
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    with pytest.raises(HierarchyValidationError, match="Ticket not found"):
        await add_related_major_link(db, ticket_id=uuid.uuid4(), related_ticket_id=uuid.uuid4())


@pytest.mark.asyncio
async def test_remove_related_major_link() -> None:
    db = AsyncMock()
    a = uuid.UUID("00000000-0000-0000-0000-000000000001")
    b = uuid.UUID("00000000-0000-0000-0000-000000000002")
    link = MagicMock()

    db.get = AsyncMock(return_value=link)
    assert await remove_related_major_link(db, ticket_id=a, related_ticket_id=b) is True
    db.delete.assert_awaited_once_with(link)

    db.get = AsyncMock(return_value=None)
    assert await remove_related_major_link(db, ticket_id=a, related_ticket_id=b) is False


@pytest.mark.asyncio
async def test_broadcast_comment_to_children() -> None:
    db = AsyncMock()
    parent = _ticket(is_major=True)
    child = _ticket()
    author = MagicMock()
    author.id = uuid.uuid4()
    now = datetime.now(UTC)

    with patch(
        "star_itsm_api.services.ticket_hierarchy.get_child_tickets",
        new_callable=AsyncMock,
        return_value=[child],
    ), patch(
        "star_itsm_api.services.ticket_hierarchy.user_can_access_ticket",
        new_callable=AsyncMock,
        return_value=True,
    ):
        posted = await broadcast_comment_to_children(
            db,
            parent=parent,
            author=author,
            body="Broadcast note",
            is_internal=True,
            is_staff_author=True,
            now=now,
        )
    assert posted == 1
    assert db.add.call_count == 2


@pytest.mark.asyncio
async def test_broadcast_comment_to_children_skips_inaccessible_child() -> None:
    db = AsyncMock()
    parent = _ticket(is_major=True)
    child = _ticket()
    author = MagicMock()
    author.id = uuid.uuid4()
    now = datetime.now(UTC)

    with patch(
        "star_itsm_api.services.ticket_hierarchy.get_child_tickets",
        new_callable=AsyncMock,
        return_value=[child],
    ), patch(
        "star_itsm_api.services.ticket_hierarchy.user_can_access_ticket",
        new_callable=AsyncMock,
        return_value=False,
    ):
        posted = await broadcast_comment_to_children(
            db,
            parent=parent,
            author=author,
            body="Broadcast note",
            is_internal=False,
            is_staff_author=False,
            now=now,
        )
    assert posted == 0
