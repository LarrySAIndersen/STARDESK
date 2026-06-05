from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.services.db_resilience import optional_db_read, rollback_session


@pytest.mark.asyncio
async def test_rollback_session_success() -> None:
    mock_db = AsyncMock()
    await rollback_session(mock_db)
    mock_db.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_rollback_session_failure() -> None:
    mock_db = AsyncMock()
    mock_db.rollback.side_effect = Exception("Rollback error")
    # Should handle the exception gracefully without raising
    await rollback_session(mock_db)
    mock_db.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_optional_db_read_success() -> None:
    mock_db = AsyncMock()
    mock_nested = MagicMock()
    mock_nested.__aenter__ = AsyncMock()
    mock_nested.__aexit__ = AsyncMock(return_value=False)
    mock_db.begin_nested = MagicMock(return_value=mock_nested)

    async def mock_operation() -> str:
        return "success"

    result = await optional_db_read(
        mock_db,
        mock_operation,
        default="fallback",
        log_message="Optional read failed",
    )
    assert result == "success"


@pytest.mark.asyncio
async def test_optional_db_read_failure() -> None:
    mock_db = AsyncMock()
    mock_nested = MagicMock()
    mock_nested.__aenter__ = AsyncMock()
    mock_nested.__aexit__ = AsyncMock(return_value=False)
    mock_db.begin_nested = MagicMock(return_value=mock_nested)

    async def mock_operation() -> str:
        raise Exception("DB query error")

    result = await optional_db_read(
        mock_db,
        mock_operation,
        default="fallback",
        log_message="Optional read failed",
    )
    assert result == "fallback"
