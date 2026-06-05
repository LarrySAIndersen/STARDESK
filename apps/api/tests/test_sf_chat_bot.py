import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.models.user import User
from star_itsm_api.services.sf_chat_bot import (
    _customer_tickets,
    _format_ticket,
    build_bot_reply_for_customer,
    mock_bot_reply,
)
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
    assert "Kilde: portal" in text


def test_format_ticket_no_source() -> None:
    ticket = make_test_ticket(
        ticket_number="INC-2026-00011",
        title="VPN fejl 2",
        status="resolved",
        priority="low",
        source=None,
        is_major=False,
    )
    text = _format_ticket(ticket)
    assert "INC-2026-00011" in text
    assert "Løst" in text
    assert "Lav" in text
    assert "Kilde" not in text


def test_mock_bot_reply_help_text() -> None:
    reply = mock_bot_reply("hjælp", [], display_name="Anna")
    assert "Sag-assistenten" in reply
    assert "Anna" in reply

    reply_hello = mock_bot_reply("hej", [], display_name=None)
    assert "Sag-assistenten" in reply_hello


def test_mock_bot_reply_empty_prompt() -> None:
    reply = mock_bot_reply("   ", [], display_name=None)
    assert "Skriv dit spørgsmål" in reply


def test_mock_bot_reply_mine_sager_lists_tickets() -> None:
    ticket = make_test_ticket(ticket_number="INC-1", title="Test", status="received", is_major=False)
    reply = mock_bot_reply("vis mine sager", [ticket], display_name="Anna")
    assert "INC-1" in reply
    assert "Modtaget" in reply


def test_mock_bot_reply_mine_sager_empty() -> None:
    reply = mock_bot_reply("vis mine sager", [], display_name=None)
    assert "Du har ingen egne sager endnu" in reply


def test_mock_bot_reply_mine_sager_ignores_major() -> None:
    ticket_major = make_test_ticket(ticket_number="INC-1", title="Major", is_major=True)
    reply = mock_bot_reply("vis mine sager", [ticket_major], display_name=None)
    assert "Du har ingen egne sager endnu" in reply


def test_mock_bot_reply_mine_sager_more_than_eight() -> None:
    tickets = [
        make_test_ticket(ticket_number=f"INC-{i}", title=f"Test {i}", is_major=False)
        for i in range(10)
    ]
    reply = mock_bot_reply("vis mine sager", tickets, display_name=None)
    assert "INC-0" in reply
    assert "INC-7" in reply
    assert "INC-8" not in reply
    assert "… og 2 mere." in reply


def test_mock_bot_reply_ticket_number_search_found() -> None:
    ticket = make_test_ticket(ticket_number="INC-2026-00050", title="Found", is_major=False)
    reply = mock_bot_reply("Hvad er status på INC-2026-00050?", [ticket], display_name=None)
    assert "INC-2026-00050" in reply
    assert "Found" in reply


def test_mock_bot_reply_ticket_number_search_not_found() -> None:
    ticket = make_test_ticket(ticket_number="INC-2026-00099", title="Other", is_major=False)
    reply = mock_bot_reply("Hvad er status på INC-2026-00050?", [ticket], display_name=None)
    assert "Jeg fandt ikke sagen INC-2026-00050" in reply


def test_mock_bot_reply_systems_mock_status() -> None:
    reply = mock_bot_reply("systemer", [], display_name=None)
    assert "IT-systemer" in reply
    assert "Integration" in reply


def test_mock_bot_reply_fallback() -> None:
    reply = mock_bot_reply("noget helt andet", [], display_name=None)
    assert "Det forstod jeg ikke helt" in reply


@pytest.mark.asyncio
async def test_customer_tickets() -> None:
    customer_id = uuid.uuid4()
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)

    tickets = await _customer_tickets(mock_db, customer_id)
    assert tickets == []


@pytest.mark.asyncio
async def test_build_bot_reply_for_customer() -> None:
    customer = User(id=uuid.uuid4(), display_name="John Doe")
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)

    reply = await build_bot_reply_for_customer(mock_db, customer=customer, message_body="hjælp")
    assert "John" in reply
    assert "Sag-assistenten" in reply
