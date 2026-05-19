from star_itsm_api.schemas.ticket_intake_assist import IntakeAssistMessage
from star_itsm_api.services.ticket_intake_assist import (
    build_intake_assist_draft,
    mock_assistant_reply,
)


def test_mock_reply_vpn() -> None:
    reply = mock_assistant_reply("Jeg kan ikke forbinde til VPN hjemmefra")
    assert "VPN" in reply


def test_build_draft_printer() -> None:
    draft = build_intake_assist_draft(
        [IntakeAssistMessage(role="user", content="Printeren på 3. sal printer ikke")]
    )
    assert "printer" in draft.title.lower() or "Printer" in draft.title
    assert "printer" in draft.tags
    assert draft.intake_answers.get("device_type") == "printer"


def test_build_draft_urgency() -> None:
    draft = build_intake_assist_draft(
        [IntakeAssistMessage(role="user", content="Akut — møde om 30 min og login virker ikke")]
    )
    assert draft.suggested_priority in ("critical", "high")


async def test_intake_assist_endpoint(client) -> None:
    response = await client.post(
        "/api/v1/tickets/intake-assist",
        json={"messages": [{"role": "user", "content": "VPN virker ikke"}]},
    )
    assert response.status_code == 200
    data = response.json()
    assert "vpn" in data["title"].lower() or "VPN" in data["title"]
    assert data["suggested_priority"] == "high"
