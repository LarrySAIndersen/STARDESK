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
