import pytest

from star_itsm_api.services.ticket_sort import (
    DEFAULT_TICKET_SORT,
    VALID_TICKET_SORTS,
    parse_ticket_sort,
)


def test_parse_ticket_sort_defaults() -> None:
    assert parse_ticket_sort(None) == DEFAULT_TICKET_SORT
    assert parse_ticket_sort("") == DEFAULT_TICKET_SORT


def test_parse_ticket_sort_allowlist() -> None:
    for value in VALID_TICKET_SORTS:
        assert parse_ticket_sort(value) == value


def test_parse_ticket_sort_rejects_unknown() -> None:
    with pytest.raises(ValueError):
        parse_ticket_sort("drop table")


def test_apply_ticket_sort() -> None:
    from sqlalchemy import select
    from star_itsm_api.models.ticket import Ticket
    from star_itsm_api.services.ticket_sort import apply_ticket_sort, VALID_TICKET_SORTS
    
    stmt = select(Ticket)
    
    # Test all valid sort options
    for sort in VALID_TICKET_SORTS:
        res = apply_ticket_sort(stmt, sort)
        assert res is not None
        
    # Test default/fallback sort option
    res_default = apply_ticket_sort(stmt, "invalid_sort_but_passed_somehow")
    assert res_default is not None

