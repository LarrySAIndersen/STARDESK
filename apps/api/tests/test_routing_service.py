import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.services import routing


@pytest.mark.asyncio
async def test_apply_routing_matches_first_rule() -> None:
    team_id = uuid.uuid4()
    user_id = uuid.uuid4()
    category_id = uuid.uuid4()
    rule = MagicMock(
        ticket_type=None,
        category_id=category_id,
        subcategory_id=None,
        min_priority=None,
        assign_team_id=team_id,
        assign_user_id=user_id,
        set_priority="high",
    )

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [rule]))
    )

    result = await routing.apply_routing(
        mock_db,
        ticket_type="incident",
        category_id=category_id,
        subcategory_id=None,
        priority="medium",
    )

    assert result.assigned_team_id == team_id
    assert result.assigned_user_id == user_id
    assert result.priority == "high"


@pytest.mark.asyncio
async def test_apply_routing_skips_low_priority() -> None:
    team_id = uuid.uuid4()
    low_rule = MagicMock(
        ticket_type=None,
        category_id=None,
        subcategory_id=None,
        min_priority="high",
        assign_team_id=team_id,
        assign_user_id=None,
        set_priority=None,
    )

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [low_rule]))
    )

    result = await routing.apply_routing(
        mock_db,
        ticket_type="incident",
        category_id=None,
        subcategory_id=None,
        priority="low",
    )

    assert result.assigned_team_id is None
    assert result.priority == "low"


@pytest.mark.asyncio
async def test_apply_routing_falls_back_when_no_rules() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: []))
    )

    result = await routing.apply_routing(
        mock_db,
        ticket_type="service_request",
        category_id=None,
        subcategory_id=None,
        priority="medium",
    )

    assert result.assigned_team_id is None
    assert result.assigned_user_id is None


@pytest.mark.asyncio
async def test_apply_routing_type_mismatch() -> None:
    # Rule specifies "incident", but we route a "service_request"
    rule = MagicMock(
        ticket_type="incident",
        category_id=None,
        subcategory_id=None,
        min_priority=None,
        assign_team_id=uuid.uuid4(),
        assign_user_id=None,
        set_priority=None,
    )

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [rule]))
    )

    result = await routing.apply_routing(
        mock_db,
        ticket_type="service_request",
        category_id=None,
        subcategory_id=None,
        priority="medium",
    )

    assert result.assigned_team_id is None


@pytest.mark.asyncio
async def test_apply_routing_category_mismatch() -> None:
    # Rule specifies category A, but we route category B
    cat_a = uuid.uuid4()
    cat_b = uuid.uuid4()
    rule = MagicMock(
        ticket_type=None,
        category_id=cat_a,
        subcategory_id=None,
        min_priority=None,
        assign_team_id=uuid.uuid4(),
        assign_user_id=None,
        set_priority=None,
    )

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [rule]))
    )

    result = await routing.apply_routing(
        mock_db,
        ticket_type="incident",
        category_id=cat_b,
        subcategory_id=None,
        priority="medium",
    )

    assert result.assigned_team_id is None


@pytest.mark.asyncio
async def test_apply_routing_subcategory_mismatch() -> None:
    # Rule specifies subcategory A, but we route subcategory B
    sub_a = uuid.uuid4()
    sub_b = uuid.uuid4()
    rule = MagicMock(
        ticket_type=None,
        category_id=None,
        subcategory_id=sub_a,
        min_priority=None,
        assign_team_id=uuid.uuid4(),
        assign_user_id=None,
        set_priority=None,
    )

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [rule]))
    )

    result = await routing.apply_routing(
        mock_db,
        ticket_type="incident",
        category_id=None,
        subcategory_id=sub_b,
        priority="medium",
    )

    assert result.assigned_team_id is None


@pytest.mark.asyncio
async def test_apply_routing_rule_priority_not_set() -> None:
    # Rule matches, but set_priority is None, so it should retain the original priority
    rule = MagicMock(
        ticket_type=None,
        category_id=None,
        subcategory_id=None,
        min_priority=None,
        assign_team_id=uuid.uuid4(),
        assign_user_id=None,
        set_priority=None,
    )

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [rule]))
    )

    result = await routing.apply_routing(
        mock_db,
        ticket_type="incident",
        category_id=None,
        subcategory_id=None,
        priority="high",
    )

    assert result.priority == "high"


@pytest.mark.asyncio
async def test_get_sf_service_desk_team_id() -> None:
    team_id = uuid.uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=lambda: team_id),
    )

    result = await routing.get_sf_service_desk_team_id(mock_db)

    assert result == team_id
