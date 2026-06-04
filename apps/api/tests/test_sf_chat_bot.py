from star_itsm_api.services.sf_chat_bot import _format_ticket, mock_bot_reply
from tests.support.tickets import make_test_ticket


def test_format_ticket_includes_status_and_priority() -> None:
    ticket = make_test_ticket(
        ticket_number="INC-2026-00010",
        title="VPN fejl",
        status="in_progress",
        priority="high",
        source="portal",
        is_major=False,
    )
    text = _format_ticket(ticket)
    assert "INC-2026-00010" in text
    assert "Igangsat" in text
    assert "Høj" in text


def test_mock_bot_reply_help_text() -> None:
    reply = mock_bot_reply("hjælp", [], display_name="Anna")
    assert "Sag-assistenten" in reply
    assert "Anna" in reply


def test_mock_bot_reply_empty_prompt() -> None:
    reply = mock_bot_reply("   ", [], display_name=None)
    assert "Skriv dit spørgsmål" in reply


def test_mock_bot_reply_mine_sager_lists_tickets() -> None:
    ticket = make_test_ticket(ticket_number="INC-1", title="Test", status="new", is_major=False)
    reply = mock_bot_reply("vis mine sager", [ticket], display_name="Anna")
    assert "INC-1" in reply


def test_mock_bot_reply_systems_mock_status() -> None:
    reply = mock_bot_reply("systemer", [], display_name=None)
    assert "IT-systemer" in reply
    assert "Integration" in reply
