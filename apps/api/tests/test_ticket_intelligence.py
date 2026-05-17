import uuid
from datetime import UTC, datetime
from unittest.mock import MagicMock

from star_itsm_api.services.ticket_intelligence import (
    compute_heuristic_scores,
    extract_semantic_topics,
    intelligence_from_ticket,
)


def _ticket(**overrides: object) -> MagicMock:
    ticket = MagicMock()
    ticket.title = "VPN virker ikke hjemmefra"
    ticket.description = "Bruger kan ikke oprette VPN forbindelse til STAR netværk."
    ticket.priority = "medium"
    ticket.ticket_type = "incident"
    ticket.is_major = False
    ticket.escalation_level = 0
    ticket.fault_displayed = False
    ticket.tags = ["vpn", "remote"]
    ticket.semantic_topics = []
    ticket.ease_score = None
    ticket.complexity_score = None
    ticket.llm_summary = None
    ticket.handling_hints = []
    ticket.intelligence_source = None
    ticket.intelligence_updated_at = None
    for key, value in overrides.items():
        setattr(ticket, key, value)
    return ticket


def test_extract_semantic_topics_includes_tags_and_keywords() -> None:
    topics = extract_semantic_topics(
        title="Printer på 3. sal",
        description="Kan ikke printe til fælles printer",
        tags=["Printer"],
    )
    assert "printer" in topics


def test_compute_heuristic_scores_major_is_harder() -> None:
    normal = _ticket()
    major = _ticket(is_major=True, priority="critical")
    ease_n, complex_n = compute_heuristic_scores(normal)
    ease_m, complex_m = compute_heuristic_scores(major)
    assert ease_m < ease_n
    assert complex_m > complex_n


def test_intelligence_from_ticket_uses_stored_scores() -> None:
    ticket = _ticket(
        ease_score=5,
        complexity_score=1,
        semantic_topics=["demo"],
        llm_summary="Test",
        handling_hints=["Hint"],
        intelligence_source="seed",
        intelligence_updated_at=datetime.now(UTC),
    )
    read = intelligence_from_ticket(ticket)
    assert read.ease_score == 5
    assert read.source == "seed"
    assert read.llm_summary == "Test"


def test_intelligence_heuristic_when_not_stored() -> None:
    read = intelligence_from_ticket(_ticket())
    assert read.source == "heuristic"
    assert read.ease_score is not None
    assert 1 <= read.ease_score <= 5
