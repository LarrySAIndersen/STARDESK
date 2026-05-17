import uuid

import pytest

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services.ticket_hierarchy import (
    HierarchyValidationError,
    normalize_link_pair,
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
