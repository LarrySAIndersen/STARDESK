from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.services import ticket_numbers


@pytest.mark.asyncio
async def test_generate_ticket_number_increments_sequence() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: "INC-2026-00012"))

    number = await ticket_numbers.generate_ticket_number(mock_db, "incident")

    assert number.startswith("INC-")
    assert number.endswith("-00013")


@pytest.mark.asyncio
async def test_generate_ticket_number_starts_at_one() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))

    number = await ticket_numbers.generate_ticket_number(mock_db, "service_request")

    assert "-00001" in number


@pytest.mark.asyncio
async def test_generate_ticket_number_invalid_format_falls_back_to_one() -> None:
    mock_db = AsyncMock()
    # This will trigger ValueError during int conversion
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: "INC-2026-INVALID"))

    number = await ticket_numbers.generate_ticket_number(mock_db, "incident")
    assert number.endswith("-00001")

    # This will trigger IndexError during parts[-1] split
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: ""))
    number = await ticket_numbers.generate_ticket_number(mock_db, "incident")
    assert number.endswith("-00001")
