"""Unit tests for personal note number generation."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.services.personal_note_numbers import (
    IDE_NOTE_PREFIX,
    generate_personal_note_number,
)


@pytest.mark.asyncio
async def test_generate_personal_note_number_starts_at_one() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    number = await generate_personal_note_number(mock_db)

    year = datetime.now(UTC).year
    assert number == f"{IDE_NOTE_PREFIX}-{year}-00001"


@pytest.mark.asyncio
async def test_generate_personal_note_number_increments_sequence() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = "IDE-2026-00042"
    mock_db.execute = AsyncMock(return_value=mock_result)

    number = await generate_personal_note_number(mock_db)

    assert number == "IDE-2026-00043"


@pytest.mark.asyncio
async def test_generate_personal_note_number_handles_invalid_suffix() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = "IDE-2026-INVALID"
    mock_db.execute = AsyncMock(return_value=mock_result)

    number = await generate_personal_note_number(mock_db)

    year = datetime.now(UTC).year
    assert number == f"{IDE_NOTE_PREFIX}-{year}-00001"
