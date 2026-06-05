import uuid as _uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.schemas.ticket_import import (
    TicketImportRequest,
    TicketImportRow,
)
from star_itsm_api.services import ticket_import as ti
from star_itsm_api.services.ticket_import import (
    _ensure_description,
    normalize_import_priority,
    normalize_import_source,
    normalize_import_status,
    normalize_import_ticket_type,
    parse_import_is_major,
)


def test_normalize_import_ticket_type_aliases():
    assert normalize_import_ticket_type("h\u00e6ndelse", default="incident") == "incident"
    assert normalize_import_ticket_type(None, default="service_request") == "service_request"
    assert normalize_import_ticket_type("unknown", default="incident") is None


def test_normalize_import_ticket_type_direct_and_invalid_default():
    assert normalize_import_ticket_type("incident", default="incident") == "incident"
    # "service-request" -> hyphen replaced with underscore -> valid
    assert normalize_import_ticket_type("service-request", default="incident") == "service_request"
    # empty raw with an invalid default -> None
    assert normalize_import_ticket_type("", default="bogus") is None
    assert normalize_import_ticket_type(None, default="bogus") is None


def test_normalize_import_priority_aliases():
    assert normalize_import_priority("kritisk", default="medium") == "critical"
    assert normalize_import_priority("h\u00f8j", default="medium") == "high"


def test_normalize_import_priority_direct_and_default():
    assert normalize_import_priority("high", default="medium") == "high"
    assert normalize_import_priority(None, default="medium") == "medium"
    assert normalize_import_priority(None, default="bogus") is None
    assert normalize_import_priority("nonsense", default="medium") is None


def test_normalize_import_status_aliases():
    assert normalize_import_status("lukket") == "closed"
    assert normalize_import_status("igang") == "in_progress"


def test_normalize_import_status_direct_and_fallbacks():
    assert normalize_import_status("new") == "new"
    assert normalize_import_status(None) == "new"
    assert normalize_import_status("   ") == "new"
    assert normalize_import_status("something-unknown") == "new"


def test_normalize_import_source_all_paths():
    assert normalize_import_source(None) == "email"
    assert normalize_import_source("  ") == "email"
    assert normalize_import_source("portal") == "portal"
    assert normalize_import_source("topdesk") == "email"
    assert normalize_import_source("whatever") == "email"


def test_parse_import_is_major():
    assert parse_import_is_major("ja") is True
    assert parse_import_is_major("0") is False


def test_parse_import_is_major_more():
    assert parse_import_is_major(None) is False
    assert parse_import_is_major(True) is True
    assert parse_import_is_major(False) is False
    assert parse_import_is_major("major") is True
    assert parse_import_is_major("nope") is False


def test_ensure_description_variants():
    assert _ensure_description("Title", "This description is long enough") == (
        "This description is long enough"
    )
    # empty description falls back to a long-enough title
    assert _ensure_description("A sufficiently long title", "") == "A sufficiently long title"
    assert _ensure_description("A sufficiently long title", None) == "A sufficiently long title"
    # short non-empty description is kept as the fallback base, then suffixed
    assert _ensure_description("Some title", "hi") == "hi (importeret fra TOPdesk)"
    # both empty/short -> suffix appended
    assert _ensure_description("abc", "") == "abc (importeret fra TOPdesk)"


def _exec(rows=None, scalar=None):
    """Build a MagicMock that mimics a SQLAlchemy result object."""
    result = MagicMock()
    result.all.return_value = [] if rows is None else rows
    result.scalar_one_or_none.return_value = scalar
    return result


def _mock_db(side_effect):
    db = MagicMock()
    db.execute = AsyncMock(side_effect=side_effect)
    db.commit = AsyncMock()
    db.flush = AsyncMock()
    db.add = MagicMock()
    return db


def _actor(org_id=None):
    return SimpleNamespace(id=_uuid.uuid4(), organization_id=org_id)


def _routing(team_id=None, user_id=None):
    return SimpleNamespace(assigned_team_id=team_id, assigned_user_id=user_id)


def _request(row_kwargs, **req_kwargs):
    return TicketImportRequest(rows=[TicketImportRow(**row_kwargs)], **req_kwargs)


@pytest.mark.asyncio
@patch("star_itsm_api.services.ticket_import.apply_sla_to_ticket", new_callable=AsyncMock)
@patch("star_itsm_api.services.ticket_import.generate_ticket_number", new_callable=AsyncMock)
@patch("star_itsm_api.services.ticket_import.apply_routing", new_callable=AsyncMock)
async def test_import_creates_ticket_with_routing_team(mock_routing, mock_gen, mock_sla):
    team_id = _uuid.uuid4()
    mock_routing.return_value = _routing(team_id=team_id)
    mock_gen.return_value = "INC-100"
    db = _mock_db([_exec(), _exec(), _exec(scalar=None)])
    payload = _request(
        {"title": "A valid ticket title", "description": "A proper description text"},
    )

    result = await ti.import_tickets_admin(db, payload=payload, actor=_actor(_uuid.uuid4()))

    assert result.created == 1
    assert result.total == 1
    mock_gen.assert_awaited_once()
    mock_sla.assert_awaited_once()
    db.commit.assert_awaited()


@pytest.mark.asyncio
@patch("star_itsm_api.services.ticket_import.apply_sla_to_ticket", new_callable=AsyncMock)
@patch("star_itsm_api.services.ticket_import.generate_ticket_number", new_callable=AsyncMock)
@patch("star_itsm_api.services.ticket_import.apply_routing", new_callable=AsyncMock)
async def test_import_creates_ticket_no_assignment_with_reporter(mock_routing, mock_gen, mock_sla):
    mock_routing.return_value = _routing(team_id=None)
    mock_gen.return_value = "INC-101"
    reporter = SimpleNamespace(id=_uuid.uuid4())
    db = _mock_db([_exec(), _exec(), _exec(scalar=reporter), _exec(scalar=None)])
    payload = _request(
        {
            "title": "Another valid ticket",
            "description": "Long enough description",
            "reporter_email": "reporter@example.dk",
        },
    )

    result = await ti.import_tickets_admin(db, payload=payload, actor=_actor())

    assert result.created == 1
    assert result.failed == 0


@pytest.mark.asyncio
@patch("star_itsm_api.services.ticket_import.apply_sla_to_ticket", new_callable=AsyncMock)
@patch("star_itsm_api.services.ticket_import.generate_ticket_number", new_callable=AsyncMock)
@patch("star_itsm_api.services.ticket_import.apply_routing", new_callable=AsyncMock)
async def test_import_creates_with_external_number_and_team(mock_routing, mock_gen, mock_sla):
    mock_routing.return_value = _routing()
    team_id = _uuid.uuid4()
    cat_id = _uuid.uuid4()
    db = _mock_db(
        [
            _exec(rows=[(team_id, "Support")]),
            _exec(rows=[(cat_id, "Hardware")]),
            _exec(scalar=None),  # existing lookup by external
            _exec(scalar=None),  # duplicate ticket_number check
        ]
    )
    payload = _request(
        {
            "title": "Ticket with external id",
            "description": "Plenty long description",
            "external_number": "EXT-1",
            "team": "Support",
            "category": "Hardware",
            "status": "closed",
            "is_major": "ja",
        },
    )

    result = await ti.import_tickets_admin(db, payload=payload, actor=_actor())

    assert result.created == 1
    mock_gen.assert_not_awaited()


@pytest.mark.asyncio
@patch("star_itsm_api.services.ticket_import.apply_sla_to_ticket", new_callable=AsyncMock)
@patch("star_itsm_api.services.ticket_import.generate_ticket_number", new_callable=AsyncMock)
@patch("star_itsm_api.services.ticket_import.apply_routing", new_callable=AsyncMock)
async def test_import_updates_existing_ticket(mock_routing, mock_gen, mock_sla):
    existing = SimpleNamespace(routing_metadata=None)
    db = _mock_db([_exec(), _exec(), _exec(scalar=existing)])
    payload = _request(
        {
            "title": "Updated title",
            "description": "Updated description text",
            "external_number": "EXT-9",
            "is_major": "ja",
        },
        on_duplicate="update",
    )

    result = await ti.import_tickets_admin(db, payload=payload, actor=_actor())

    assert result.updated == 1
    assert existing.title == "Updated title"
    assert existing.routing_metadata["import_source"] == "topdesk"
    assert existing.routing_metadata["external_number"] == "EXT-9"
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_import_skips_existing_ticket():
    existing = SimpleNamespace(routing_metadata={})
    db = _mock_db([_exec(), _exec(), _exec(scalar=existing)])
    payload = _request(
        {
            "title": "Skip me ticket",
            "description": "A long enough description",
            "external_number": "EXT-9",
        },
        on_duplicate="skip",
    )

    result = await ti.import_tickets_admin(db, payload=payload, actor=_actor())

    assert result.skipped == 1


@pytest.mark.asyncio
@patch("star_itsm_api.services.ticket_import.apply_routing", new_callable=AsyncMock)
async def test_import_duplicate_ticket_number_error(mock_routing):
    mock_routing.return_value = _routing()
    existing_dup = SimpleNamespace()
    db = _mock_db(
        [
            _exec(),
            _exec(),
            _exec(scalar=None),  # no existing by external
            _exec(scalar=existing_dup),  # ticket_number already exists
        ]
    )
    payload = _request(
        {
            "title": "Dup number ticket",
            "description": "A long enough description",
            "external_number": "EXT-DUP",
        },
        on_duplicate="update",
    )

    result = await ti.import_tickets_admin(db, payload=payload, actor=_actor())

    assert result.failed == 1
    assert "findes allerede" in result.errors[0].message


@pytest.mark.asyncio
async def test_import_missing_title_error():
    db = _mock_db([_exec(), _exec()])
    payload = _request({"title": " ", "description": "ignored"})

    result = await ti.import_tickets_admin(db, payload=payload, actor=_actor())

    assert result.failed == 1
    assert result.errors[0].message == "Titel mangler"


@pytest.mark.asyncio
async def test_import_unknown_type_error():
    db = _mock_db([_exec(), _exec()])
    payload = _request({"title": "Valid title here", "ticket_type": "bogus"})

    result = await ti.import_tickets_admin(db, payload=payload, actor=_actor())

    assert result.failed == 1
    assert "Ukendt sagstype" in result.errors[0].message


@pytest.mark.asyncio
async def test_import_unknown_priority_error():
    db = _mock_db([_exec(), _exec()])
    payload = _request({"title": "Valid title here", "priority": "bogus"})

    result = await ti.import_tickets_admin(db, payload=payload, actor=_actor())

    assert result.failed == 1
    assert "Ukendt prioritet" in result.errors[0].message


@pytest.mark.asyncio
async def test_import_unknown_category_error():
    db = _mock_db([_exec(), _exec()])
    payload = _request({"title": "Valid title here", "category": "Nope"})

    result = await ti.import_tickets_admin(db, payload=payload, actor=_actor())

    assert result.failed == 1
    assert "Ukendt kategori" in result.errors[0].message


@pytest.mark.asyncio
async def test_import_unknown_team_error():
    db = _mock_db([_exec(), _exec()])
    payload = _request({"title": "Valid title here", "team": "Nope"})

    result = await ti.import_tickets_admin(db, payload=payload, actor=_actor())

    assert result.failed == 1
    assert "Ukendt gruppe" in result.errors[0].message


@pytest.mark.asyncio
async def test_import_unknown_reporter_error():
    db = _mock_db([_exec(), _exec(), _exec(scalar=None)])
    payload = _request(
        {"title": "Valid title here", "reporter_email": "missing@example.dk"},
    )

    result = await ti.import_tickets_admin(db, payload=payload, actor=_actor())

    assert result.failed == 1
    assert "Ukendt indmelder" in result.errors[0].message
