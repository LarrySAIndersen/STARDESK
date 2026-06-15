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
    assert any(s.slug == "printer" for s in draft.tag_suggestions)


def test_build_draft_urgency() -> None:
    draft = build_intake_assist_draft(
        [IntakeAssistMessage(role="user", content="Akut — møde om 30 min og login virker ikke")]
    )
    assert draft.suggested_priority in ("critical", "high")


def test_mock_reply_fallback() -> None:
    reply = mock_assistant_reply("noget med ost")
    assert "noteret beskrivelsen" in reply


def test_build_draft_fallback() -> None:
    draft = build_intake_assist_draft(
        [IntakeAssistMessage(role="user", content="noget med ost")]
    )
    assert draft.title == "noget med ost"
    assert draft.suggested_priority == "medium"
    assert "it-support" in draft.tags


def test_fallback_title_variations() -> None:
    from star_itsm_api.services.ticket_intake_assist import _fallback_title
    
    # Empty / whitespace
    assert _fallback_title("   ") == "IT-support henvendelse"
    
    # Long title truncation
    long_text = "Dette er en meget lang tekst der helt sikkert vil overstige firs tegn og derfor skal trunkeres pænt med tre prikker til sidst"
    truncated = _fallback_title(long_text)
    assert len(truncated) == 78  # 77 chars + 1 char for '…'
    assert truncated.endswith("…")


async def test_intake_assist_endpoint(client) -> None:
    response = await client.post(
        "/api/v1/tickets/intake-assist",
        json={"messages": [{"role": "user", "content": "VPN virker ikke"}]},
    )
    assert response.status_code == 200
    data = response.json()
    assert "vpn" in data["title"].lower() or "VPN" in data["title"]
    assert data["suggested_priority"] == "high"
