from datetime import datetime, UTC, timedelta
import uuid
from unittest.mock import MagicMock, patch

import pytest

from star_itsm_api.services.ticket_routing import (
    ROUTING_READY_THRESHOLD,
    _TeamRef,
    _routing_metadata,
    _match_team_by_names,
    intake_answers_from_ticket,
    intake_metadata_from_answers,
    merge_intake_answers,
    build_ticket_routing,
    compute_completeness,
    compute_suggested_priority,
    suggest_team,
)


def _ticket(**overrides: object) -> MagicMock:
    ticket = MagicMock()
    ticket.title = "VPN virker ikke"
    ticket.description = (
        "Jeg kan ikke oprette forbindelse til STAR netværk fra hjemmekontor. "
        "Fejlen startede i morges."
    )
    ticket.category_id = "cat-1"
    ticket.subcategory_id = "sub-1"
    ticket.priority = "medium"
    ticket.ticket_type = "incident"
    ticket.status = "new"
    ticket.is_major = False
    ticket.resolution_due_at = None
    ticket.assigned_team_id = None
    ticket.tags = ["vpn"]
    ticket.routing_metadata = {}
    for key, value in overrides.items():
        setattr(ticket, key, value)
    return ticket


def test_intake_metadata_from_answers() -> None:
    meta = intake_metadata_from_answers({"vpn_remote": "ja", "urgency": ""})
    assert meta == {"intake": {"answers": {"vpn_remote": "ja"}}}


def test_completeness_low_without_intake() -> None:
    score, missing = compute_completeness(
        _ticket(
            routing_metadata={},
            category_id=None,
            subcategory_id=None,
            tags=[],
            description="Kort beskrivelse",
        ),
        category_name_da=None,
        sub_causes_count=0,
    )
    assert score < ROUTING_READY_THRESHOLD
    assert any("indtags" in field for field in missing)


def test_completeness_ready_with_intake() -> None:
    ticket = _ticket(
        routing_metadata={"intake": {"answers": {"vpn_remote": "ja", "device_type": "laptop"}}},
    )
    score, missing = compute_completeness(ticket, category_name_da="Netværk", sub_causes_count=1)
    assert score >= ROUTING_READY_THRESHOLD
    routing = build_ticket_routing(
        ticket,
        category_name_da="Netværk og internet",
        sub_causes_count=1,
        teams=[_TeamRef(id="00000000-0000-0000-0000-000000000101", name="SF Infrastruktur")],
    )
    assert routing.routing_ready is True
    assert routing.suggested_team_name == "SF Infrastruktur"


def test_suggest_vpn_team() -> None:
    routing = build_ticket_routing(
        _ticket(),
        category_name_da="Netværk",
        teams=[
            _TeamRef(id="00000000-0000-0000-0000-000000000201", name="SF Service Desk"),
            _TeamRef(id="00000000-0000-0000-0000-000000000202", name="SF Infrastruktur"),
        ],
    )
    assert routing.suggested_team_name == "SF Infrastruktur"
    assert (routing.routing_confidence or 0) >= 70


def test_computed_priority_critical_keyword() -> None:
    routing = build_ticket_routing(
        _ticket(
            title="Kritisk nedetid i produktion",
            description="Hele systemet er nede for alle brugere.",
        ),
        teams=[],
    )
    assert routing.computed_priority == "critical"


def test_routing_metadata_handling() -> None:
    ticket = MagicMock()
    ticket.routing_metadata = "invalid"  # not a dict
    assert _routing_metadata(ticket) == {}

    ticket.routing_metadata = {"test": 123}
    assert _routing_metadata(ticket) == {"test": 123}


def test_intake_answers_from_ticket_variations() -> None:
    # Answers is not dict
    ticket = _ticket(routing_metadata={"intake": {"answers": "not_a_dict"}})
    assert intake_answers_from_ticket(ticket) == {}

    # Empty intake
    ticket = _ticket(routing_metadata={"intake": None})
    assert intake_answers_from_ticket(ticket) == {}

    # Answers contains empty/None values
    ticket = _ticket(routing_metadata={"intake": {"answers": {"q1": "  ", "q2": None, "q3": "valid"}}})
    assert intake_answers_from_ticket(ticket) == {"q3": "valid"}


def test_intake_metadata_from_answers_empty() -> None:
    assert intake_metadata_from_answers(None) == {}
    assert intake_metadata_from_answers({"key": "  "}) == {}


def test_merge_intake_answers() -> None:
    ticket = _ticket(routing_metadata={"intake": {"answers": {"q1": "val1"}}})
    merged = merge_intake_answers(ticket, {"q1": "newval", "q2": "val2", "q3": " "})
    assert merged["intake"]["answers"] == {"q1": "newval", "q2": "val2"}


def test_merge_intake_answers_empty() -> None:
    ticket = _ticket(routing_metadata={"intake": {"answers": {"q1": "val1"}}})
    merged = merge_intake_answers(ticket, None)
    assert merged["intake"]["answers"] == {"q1": "val1"}


def test_compute_completeness_desc_len_medium() -> None:
    # Description length between 40 and 80
    ticket = _ticket(
        description="A" * 50,
        category_id="cat-1",
        subcategory_id="sub-1",
    )
    score, missing = compute_completeness(ticket, category_name_da="Netværk", sub_causes_count=0)
    assert "længere beskrivelse" not in missing


def test_compute_completeness_no_tags_no_topics() -> None:
    ticket = _ticket(
        title="x",
        description="x",
        tags=[],
    )
    score, missing = compute_completeness(ticket, category_name_da="Netværk", sub_causes_count=0)
    assert "tags eller emner" in missing


def test_compute_completeness_one_answer() -> None:
    ticket = _ticket(
        routing_metadata={"intake": {"answers": {"vpn_remote": "ja"}}},
    )
    score, missing = compute_completeness(ticket, category_name_da="Netværk", sub_causes_count=0)
    assert "flere indtags-svar" in missing


def test_compute_completeness_category_with_adgang_no_subcauses() -> None:
    ticket = _ticket()
    score, missing = compute_completeness(ticket, category_name_da="Adgang til system", sub_causes_count=0)
    assert "underårsag" not in missing


def test_compute_suggested_priority_SLA_overdue_aware() -> None:
    # Overdue with timezone-aware datetime
    due = datetime.now(UTC) - timedelta(hours=1)
    ticket = _ticket(resolution_due_at=due, status="new")
    priority, reasons = compute_suggested_priority(ticket, topics=[])
    assert priority == "high"
    assert "SLA overskredet" in reasons


def test_compute_suggested_priority_SLA_overdue_naive() -> None:
    # Overdue with naive datetime (constructed relative to UTC to avoid timezone/DST issues)
    due = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1)
    ticket = _ticket(resolution_due_at=due, status="new")
    priority, reasons = compute_suggested_priority(ticket, topics=[])
    assert priority == "high"
    assert "SLA overskredet" in reasons


def test_compute_suggested_priority_SLA_not_overdue() -> None:
    due = datetime.now(UTC) + timedelta(hours=10)
    ticket = _ticket(resolution_due_at=due, status="new")
    priority, reasons = compute_suggested_priority(ticket, topics=[])
    assert priority == "medium"
    assert "SLA overskredet" not in reasons


def test_compute_suggested_priority_SLA_overdue_but_closed() -> None:
    due = datetime.now(UTC) - timedelta(hours=1)
    ticket = _ticket(resolution_due_at=due, status="closed")
    priority, reasons = compute_suggested_priority(ticket, topics=[])
    assert priority == "medium"
    assert "SLA overskredet" not in reasons


def test_compute_suggested_priority_is_major() -> None:
    ticket = _ticket(is_major=True)
    priority, reasons = compute_suggested_priority(ticket, topics=[])
    assert priority == "high"
    assert "stor sag" in reasons


def test_compute_suggested_priority_urgent_intake_answer() -> None:
    ticket = _ticket(
        routing_metadata={"intake": {"answers": {"urgency": "Det er et VIGTIGT MØDE"}}},
    )
    priority, reasons = compute_suggested_priority(ticket, topics=[])
    assert priority == "high"
    assert "hastende indtags-svar" in reasons


def test_compute_suggested_priority_standard_assessment() -> None:
    ticket = _ticket(priority="low", status="closed")
    priority, reasons = compute_suggested_priority(ticket, topics=[])
    assert priority == "low"
    assert "standard vurdering ud fra sagstype og status" in reasons


def test_compute_suggested_priority_unrecognized_level_reasons() -> None:
    ticket = _ticket(priority="unrecognized", ticket_type="other", status="closed")
    with patch("star_itsm_api.services.ticket_routing._PRIORITY_ORDER", {"critical": 4, "high": 3, "low": 1}):
        priority, reasons = compute_suggested_priority(ticket, topics=[])
        assert priority == "medium"
        assert reasons == ["standard vurdering"]


def test_match_team_by_names_partial_match() -> None:
    teams = [_TeamRef(id=uuid.uuid4(), name="Special Netværk")]
    matched = _match_team_by_names(teams, ("Netværk",))
    assert matched == teams[0]


def test_suggest_team_variations() -> None:
    # No teams
    team, confidence, reason = suggest_team(_ticket(), [], category_name=None, topics=[])
    assert team is None
    assert confidence == 0

    # Partial name match in _match_team_by_names
    teams = [
        _TeamRef(id=uuid.uuid4(), name="Applikations-support"),
    ]
    ticket = _ticket(title="outlook issue")  # matches 'mail' pattern which maps to Applikation
    team, confidence, reason = suggest_team(ticket, teams, category_name=None, topics=[])
    assert team.name == "Applikations-support"
    assert confidence == 85

    # Category name hints matching (use "hardware" to avoid matching patterns in title/description/topics)
    teams = [
        _TeamRef(id=uuid.uuid4(), name="SF Service Desk"),
    ]
    ticket = _ticket(title="generic", description="generic", tags=[])
    team, confidence, reason = suggest_team(ticket, teams, category_name="hardware", topics=[])
    assert team.name == "SF Service Desk"
    assert confidence == 72

    # Default tildeling fallback to Service Desk
    teams = [
        _TeamRef(id=uuid.uuid4(), name="Other Team"),
        _TeamRef(id=uuid.uuid4(), name="SF Service Desk"),
    ]
    ticket = _ticket(title="generic title", description="generic description", tags=[])
    team, confidence, reason = suggest_team(ticket, teams, category_name=None, topics=[])
    assert team.name == "SF Service Desk"
    assert confidence == 45

    # Default fallback (patch _match_team_by_names to return None so we can test the fallback return teams[0])
    teams = [
        _TeamRef(id=uuid.uuid4(), name="Other Team"),
    ]
    ticket = _ticket(title="generic title", description="generic description", tags=[])
    with patch("star_itsm_api.services.ticket_routing._match_team_by_names", return_value=None):
        team, confidence, reason = suggest_team(ticket, teams, category_name=None, topics=[])
        assert team.name == "Other Team"
        assert confidence == 40


def test_suggest_team_match_team_by_names_returns_none() -> None:
    # Test branch where suggest_team continues looping if _match_team_by_names returns None
    teams = [_TeamRef(id=uuid.uuid4(), name="Some Team")]
    ticket = _ticket(title="vpn issue", tags=[])
    # First call in pattern matching loop returns None, second call in category matching loop returns None,
    # third call in default tildeling returns the fallback team.
    fallback_team = _TeamRef(id=uuid.uuid4(), name="Fallback Team")
    with patch("star_itsm_api.services.ticket_routing._match_team_by_names", side_effect=[None, None, fallback_team]):
        team, confidence, reason = suggest_team(ticket, teams, category_name="hardware", topics=[])
        assert team == fallback_team
        assert confidence == 45
