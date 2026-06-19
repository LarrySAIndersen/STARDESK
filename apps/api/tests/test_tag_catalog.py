"""Tests for tag catalog and ticket similarity."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import select

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.schemas.tag_catalog import SimilarTicketRead, TagSuggestionRead
from star_itsm_api.services.tag_catalog import (
    get_catalog_entry,
    list_catalog_entries,
    merge_tag_suggestions,
    normalize_tags_to_catalog,
    resolve_to_catalog_slug,
    slugs_from_suggestions,
    suggest_tags_from_text,
)
from star_itsm_api.services.ticket_search import (
    apply_ticket_search_filter,
    apply_ticket_tags_filter,
)
from star_itsm_api.services.ticket_similarity import (
    _candidate_search_terms,
    _jaccard,
    _overlap_labels,
    find_similar_tickets,
    score_ticket_similarity,
)


def test_list_catalog_entries_not_empty() -> None:
    entries = list_catalog_entries()
    assert len(entries) >= 10
    assert any(entry.slug == "vpn" for entry in entries)


def test_resolve_synonym_to_canonical_slug() -> None:
    assert resolve_to_catalog_slug("outlook") == "mail"
    assert resolve_to_catalog_slug("vpn") == "vpn"


def test_suggest_tags_from_vpn_text() -> None:
    suggestions = suggest_tags_from_text("Jeg kan ikke forbinde til VPN hjemmefra")
    slugs = [item.slug for item in suggestions]
    assert "vpn" in slugs
    assert suggestions[0].source == "catalog_keyword"


def test_suggest_tags_returns_empty_for_blank_text() -> None:
    assert suggest_tags_from_text("   ") == []


def test_resolve_to_catalog_slug_handles_blank() -> None:
    assert resolve_to_catalog_slug("  ") is None


def test_get_catalog_entry_returns_none_for_unknown() -> None:
    assert get_catalog_entry("not-a-real-tag") is None


def test_normalize_tags_to_catalog_deduplicates() -> None:
    assert normalize_tags_to_catalog(["vpn", "VPN", "vpn"]) == ["vpn"]


def test_normalize_tags_to_catalog_maps_synonyms() -> None:
    assert "mail" in normalize_tags_to_catalog(["outlook", "printer"])


def test_apply_ticket_tags_filter_any() -> None:
    base = select(Ticket)
    filtered = apply_ticket_tags_filter(base, ["vpn", "printer"], match_all=False)
    assert filtered is not base


def test_apply_ticket_tags_filter_skips_empty() -> None:
    base = select(Ticket)
    assert apply_ticket_tags_filter(base, None) is base
    assert apply_ticket_tags_filter(base, []) is base


def test_score_ticket_similarity_tag_overlap() -> None:
    source = SimpleNamespace(
        title="VPN fejl",
        description="Kan ikke logge på vpn",
        tags=["vpn", "netværk"],
        semantic_topics=["vpn"],
        llm_summary="VPN fejl løst ved genstart",
    )
    candidate = SimpleNamespace(
        title="VPN virker ikke",
        description="Fjernarbejde problem",
        tags=["vpn", "fjernarbejde"],
        semantic_topics=["vpn", "fjernarbejde"],
        llm_summary="VPN fejl løst ved genstart",
    )
    score, reasons = score_ticket_similarity(source, candidate)
    assert score > 0.2
    assert any("Fælles tags" in reason for reason in reasons)
    assert any("emner" in reason for reason in reasons)
    assert any("opsummering" in reason for reason in reasons)


def test_jaccard_empty_sets_returns_zero() -> None:
    assert _jaccard(set(), {"vpn"}) == 0.0
    assert _jaccard({"vpn"}, set()) == 0.0


def test_overlap_labels_truncates_long_lists() -> None:
    label = _overlap_labels({"a", "b", "c", "d", "e", "f"}, prefix_da="Fælles tags")
    assert label is not None
    assert "+2" in label


def test_candidate_search_terms_deduplicates_topics() -> None:
    ticket = SimpleNamespace(
        title="VPN forbindelse fejler hjemmefra",
        tags=["vpn"],
        semantic_topics=["vpn", "fjernarbejde"],
    )
    terms = _candidate_search_terms(ticket)
    assert terms.count("vpn") == 1
    assert "fjernarbejde" in terms


def test_get_catalog_entry_and_merge_suggestions() -> None:
    entry = get_catalog_entry("vpn")
    assert entry is not None
    assert entry.slug == "vpn"
    assert get_catalog_entry("unknown-slug-xyz") is None

    low = TagSuggestionRead(
        slug="vpn",
        label_da="VPN",
        confidence=0.5,
        source="catalog_keyword",
        reason_da="test",
    )
    high = TagSuggestionRead(
        slug="vpn",
        label_da="VPN",
        confidence=0.9,
        source="catalog_keyword",
        reason_da="better",
    )
    merged = merge_tag_suggestions([low], [high])
    assert merged[0].confidence == 0.9
    assert slugs_from_suggestions(merged) == ["vpn"]


def test_normalize_tags_to_catalog_handles_invalid_values() -> None:
    assert normalize_tags_to_catalog(None) == []
    assert normalize_tags_to_catalog(["", "   "]) == []


def test_apply_ticket_search_and_tags_filters() -> None:
    base = select(Ticket)
    assert apply_ticket_search_filter(base, None) is base
    assert apply_ticket_search_filter(base, "  ") is base
    assert apply_ticket_search_filter(base, "printer") is not base

    tagged = apply_ticket_tags_filter(base, ["vpn", "printer"], match_all=True)
    assert tagged is not base
    assert apply_ticket_tags_filter(base, ["  "]) is base


@pytest.mark.asyncio
async def test_find_similar_tickets_returns_scored_candidates() -> None:
    source_id = uuid.uuid4()
    candidate_id = uuid.uuid4()
    source = SimpleNamespace(
        id=source_id,
        title="VPN fejl",
        description="Kan ikke logge på vpn",
        tags=["vpn"],
        semantic_topics=["vpn"],
        llm_summary=None,
    )
    candidate = SimpleNamespace(
        id=candidate_id,
        ticket_number="INC-9001",
        title="VPN virker ikke",
        description="vpn problem hjemmefra",
        status="resolved",
        tags=["vpn"],
        semantic_topics=["vpn"],
        llm_summary=None,
        updated_at=None,
        created_at=None,
    )
    weak = SimpleNamespace(
        id=uuid.uuid4(),
        ticket_number="INC-9002",
        title="Printer",
        description="papir",
        status="open",
        tags=["printer"],
        semantic_topics=[],
        llm_summary=None,
        updated_at=None,
        created_at=None,
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [candidate, weak]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    user = SimpleNamespace(id=uuid.uuid4(), role="admin")
    similar = await find_similar_tickets(mock_db, source, user, limit=5, closed_only=True)
    assert len(similar) == 1
    assert similar[0].ticket_number == "INC-9001"
    assert similar[0].score > 0.05
    assert similar[0].match_reasons


@pytest.mark.asyncio
async def test_find_similar_tickets_without_search_terms() -> None:
    source = SimpleNamespace(
        id=uuid.uuid4(),
        title="ab",
        description="cd",
        tags=[],
        semantic_topics=[],
        llm_summary=None,
    )
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    user = SimpleNamespace(id=uuid.uuid4(), role="admin")
    similar = await find_similar_tickets(mock_db, source, user, limit=3)
    assert similar == []


@pytest.mark.asyncio
async def test_validate_tags_endpoint(api_client) -> None:
    response = await api_client.get("/api/v1/tags/validate?tags=vpn,not-in-catalog")
    assert response.status_code == 200
    body = response.json()
    assert "vpn" in body["known"]
    assert "not-in-catalog" in body["unknown"]


@pytest.mark.asyncio
async def test_validate_tags_rejects_invalid_input(api_client) -> None:
    response = await api_client.get("/api/v1/tags/validate?tags=!!!")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_tags_with_usage_counts(api_client, override_db: AsyncMock) -> None:
    mock_result = MagicMock()
    mock_result.all.return_value = [(["vpn", "printer"],), (["vpn"],)]
    override_db.execute = AsyncMock(return_value=mock_result)

    response = await api_client.get("/api/v1/tags?include_usage=true")
    assert response.status_code == 200
    body = response.json()
    vpn = next(item for item in body if item["slug"] == "vpn")
    assert vpn["usage_count"] == 2


@pytest.mark.asyncio
async def test_similar_tickets_happy_path(api_client, override_db: AsyncMock, monkeypatch) -> None:
    ticket_id = uuid.uuid4()
    ticket = SimpleNamespace(id=ticket_id, deleted_at=None)
    override_db.get = AsyncMock(return_value=ticket)

    async def fake_find_similar(_db, _source, _user, **kwargs):
        return [
            SimilarTicketRead(
                id=str(uuid.uuid4()),
                ticket_number="INC-42",
                title="VPN fejl",
                status="resolved",
                score=0.42,
                match_reasons=["Fælles tags: vpn"],
                tags=["vpn"],
            )
        ]

    monkeypatch.setattr(
        "star_itsm_api.routers.tickets.find_similar_tickets",
        fake_find_similar,
    )

    response = await api_client.get(f"/api/v1/tickets/{ticket_id}/similar?closed_only=true")
    assert response.status_code == 200
    body = response.json()
    assert body[0]["ticket_number"] == "INC-42"


@pytest.mark.asyncio
async def test_list_tags_endpoint(api_client) -> None:
    response = await api_client.get("/api/v1/tags?include_usage=false")
    assert response.status_code == 200
    body = response.json()
    assert any(item["slug"] == "printer" for item in body)


@pytest.mark.asyncio
async def test_suggest_tags_endpoint(api_client) -> None:
    response = await api_client.get("/api/v1/tags/suggest?text=Printeren+udskriver+ikke")
    assert response.status_code == 200
    body = response.json()
    assert "printer" in body["suggested_slugs"]


@pytest.mark.asyncio
async def test_list_tickets_invalid_tags_match(api_client) -> None:
    response = await api_client.get("/api/v1/tickets?tags=vpn&tags_match=broken")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_similar_tickets_not_found(api_client) -> None:
    missing = uuid.uuid4()
    response = await api_client.get(f"/api/v1/tickets/{missing}/similar")
    assert response.status_code == 404
