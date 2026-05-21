from star_itsm_api.services.ticket_import import (
    normalize_import_priority,
    normalize_import_status,
    normalize_import_ticket_type,
    parse_import_is_major,
)


def test_normalize_import_ticket_type_aliases():
    assert normalize_import_ticket_type("hændelse", default="incident") == "incident"
    assert normalize_import_ticket_type(None, default="service_request") == "service_request"
    assert normalize_import_ticket_type("unknown", default="incident") is None


def test_normalize_import_priority_aliases():
    assert normalize_import_priority("kritisk", default="medium") == "critical"
    assert normalize_import_priority("høj", default="medium") == "high"


def test_normalize_import_status_aliases():
    assert normalize_import_status("lukket") == "closed"
    assert normalize_import_status("igang") == "in_progress"


def test_parse_import_is_major():
    assert parse_import_is_major("ja") is True
    assert parse_import_is_major("0") is False
