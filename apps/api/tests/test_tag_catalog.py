"""Tests for tag catalog and ticket similarity."""

import uuid
from types import SimpleNamespace

import pytest

from star_itsm_api.services.tag_catalog import (
    list_catalog_entries,
    normalize_tags_to_catalog,
    resolve_to_catalog_slug,
    suggest_tags_from_text,
)
from star_itsm_api.services.ticket_search import apply_ticket_tags_filter
from star_itsm_api.services.ticket_similarity import score_ticket_similarity
from sqlalchemy import select

from star_itsm_api.models.ticket import Ticket


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
        llm_summary=None,
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
