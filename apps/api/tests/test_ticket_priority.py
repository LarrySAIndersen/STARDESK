import pytest
from pydantic import ValidationError

from star_itsm_api.schemas.ticket import TicketPriorityUpdate
from star_itsm_api.services.ticket_activity import _event_label


def test_ticket_priority_update_requires_min_reason_length() -> None:
    with pytest.raises(ValidationError):
        TicketPriorityUpdate(priority="high", reason="for kort")


def test_ticket_priority_update_accepts_valid_reason() -> None:
    payload = TicketPriorityUpdate(
        priority="high",
        reason="Kunden har eskaleret til ledelsen.",
    )
    assert payload.priority == "high"
    assert payload.reason.startswith("Kunden")


def test_priority_changed_event_label() -> None:
    label, visibility, detail = _event_label(
        "ticket.priority_changed",
        {
            "previous_priority": "medium",
            "priority": "high",
            "reason": "Produktionsstop på fabrikken.",
        },
    )
    assert label == "Prioritet ændret: Medium → Høj"
    assert visibility == "internal"
    assert detail == "Produktionsstop på fabrikken."


async def test_update_priority_without_database_returns_503(client) -> None:
    response = await client.patch(
        "/api/v1/tickets/00000000-0000-0000-0000-000000000001/priority",
        json={
            "priority": "high",
            "reason": "Kritisk forretningspåvirkning.",
        },
    )
    assert response.status_code == 503
