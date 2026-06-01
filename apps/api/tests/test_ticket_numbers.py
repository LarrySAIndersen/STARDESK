from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.services import ticket_numbers


@pytest.mark.asyncio
async def test_generate_ticket_number_increments_sequence() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar=lambda: 12))

    number = await ticket_numbers.generate_ticket_number(mock_db, "incident")

    assert number.startswith("INC-")
    assert number.endswith("-00013")


@pytest.mark.asyncio
async def test_generate_ticket_number_starts_at_one() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar=lambda: None))

    number = await ticket_numbers.generate_ticket_number(mock_db, "service_request")

    assert "-00001" in number
