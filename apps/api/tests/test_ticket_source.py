import pytest

from star_itsm_api.services.ticket_source import (
    resolve_ticket_source_on_create,
    ticket_source_label_da,
)


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("email", "E-mail"),
        ("phone", "Telefon"),
        ("chat", "Chat"),
        ("portal", "Selvbetjening"),
        ("api", "API"),
        ("knowledge", "Vidensartikel"),
        ("legacy_unknown", "Andet"),
        ("", "Andet"),
    ],
)
def test_ticket_source_label_da(source: str, expected: str) -> None:
    assert ticket_source_label_da(source) == expected


def test_ticket_source_label_da_none() -> None:
    assert ticket_source_label_da(None) == "Andet"


def test_resolve_submitter_always_portal() -> None:
    assert resolve_ticket_source_on_create(is_staff_user=False, requested=None) == "portal"
    assert resolve_ticket_source_on_create(is_staff_user=False, requested="phone") == "portal"


def test_resolve_staff_defaults_phone() -> None:
    assert resolve_ticket_source_on_create(is_staff_user=True, requested=None) == "phone"
    assert resolve_ticket_source_on_create(is_staff_user=True, requested="bogus") == "phone"


@pytest.mark.parametrize(
    "requested",
    ["portal", "email", "phone", "chat"],
)
def test_resolve_staff_accepts_canonical(requested: str) -> None:
    assert resolve_ticket_source_on_create(is_staff_user=True, requested=requested) == requested
