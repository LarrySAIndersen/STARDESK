from unittest.mock import MagicMock

from star_itsm_api.services.ticket_routing import (
    ROUTING_READY_THRESHOLD,
    _TeamRef,
    build_ticket_routing,
    compute_completeness,
    intake_metadata_from_answers,
)


def _ticket(**overrides: object) -> MagicMock:
    ticket = MagicMock()
    ticket.title = "VPN virker ikke"
    ticket.description = "Jeg kan ikke oprette forbindelse til STAR netværk fra hjemmekontor. Fejlen startede i morges."
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
        _ticket(title="Kritisk nedetid i produktion", description="Hele systemet er nede for alle brugere."),
        teams=[],
    )
    assert routing.computed_priority == "critical"
