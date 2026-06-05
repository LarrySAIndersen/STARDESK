import uuid
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import HTTPException

from star_itsm_api.models.sla import SlaPolicy
from star_itsm_api.models.team import Team
from star_itsm_api.models.sla_settings import SlaSettings
from star_itsm_api.schemas.sla_admin import SlaPolicyUpdate, SlaSettingsUpdate
from star_itsm_api.services.sla_admin import (
    list_sla_policies,
    list_standard_sla_rules,
    update_sla_policy,
    get_sla_settings_admin,
    update_sla_settings_admin,
)


@pytest.mark.asyncio
async def test_list_sla_policies() -> None:
    db = AsyncMock()
    policy1 = SlaPolicy(
        id=uuid.uuid4(),
        name="A Policy",
        response_time_minutes=60,
        resolution_time_minutes=240,
        business_hours_only=False,
        is_active=True,
    )
    policy2 = SlaPolicy(
        id=uuid.uuid4(),
        name="B Policy",
        response_time_minutes=120,
        resolution_time_minutes=480,
        business_hours_only=True,
        is_active=False,
    )
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [policy1, policy2]
    db.execute = AsyncMock(return_value=mock_result)
    
    res = await list_sla_policies(db)
    assert len(res) == 2
    assert res[0].name == "A Policy"
    assert res[1].name == "B Policy"
    assert res[0].response_time_minutes == 60
    assert res[1].business_hours_only is True


def test_list_standard_sla_rules() -> None:
    res = list_standard_sla_rules()
    assert len(res) > 0
    assert any(r.priority == "critical" for r in res)


@pytest.mark.asyncio
async def test_update_sla_policy_not_found() -> None:
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    
    payload = SlaPolicyUpdate(response_time_minutes=30)
    with pytest.raises(HTTPException) as exc_info:
        await update_sla_policy(db, uuid.uuid4(), payload)
    assert exc_info.value.status_code == 404
    assert "SLA-politik ikke fundet" in exc_info.value.detail


@pytest.mark.asyncio
async def test_update_sla_policy_success() -> None:
    db = AsyncMock()
    policy_id = uuid.uuid4()
    policy = SlaPolicy(
        id=policy_id,
        name="Test Policy",
        response_time_minutes=60,
        resolution_time_minutes=240,
        business_hours_only=False,
        is_active=True,
    )
    # Dynamically set description attribute so hasattr(policy, "description") is True
    policy.description = None
    db.get = AsyncMock(return_value=policy)
    
    class MockSlaPolicyUpdate(SlaPolicyUpdate):
        def model_dump(self, *args, **kwargs):
            return {
                "response_time_minutes": 30,
                "description": "Updated description",
                "is_active": False,
                "non_existent_field": "value"
            }

    payload = MockSlaPolicyUpdate(
        response_time_minutes=30,
        description="Updated description",
        is_active=False,
    )
    res = await update_sla_policy(db, policy_id, payload)
    assert res.response_time_minutes == 30
    assert res.description == "Updated description"
    assert res.is_active is False
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(policy)


@pytest.mark.asyncio
async def test_get_sla_settings_admin() -> None:
    db = AsyncMock()
    
    settings_row = SlaSettings(
        id=uuid.uuid4(),
        pause_on_hold=True,
        pause_statuses=["on_hold"],
        trigger_team_ids=[],
        sla_starts_on_team_assignment=False,
        due_soon_minutes=60,
    )
    db.get = AsyncMock(return_value=settings_row)
    
    team1 = Team(id=uuid.uuid4(), name="Team A", is_active=True)
    team2 = Team(id=uuid.uuid4(), name="Team B", is_active=True)
    mock_teams_result = MagicMock()
    mock_teams_result.scalars.return_value.all.return_value = [team1, team2]
    db.execute = AsyncMock(return_value=mock_teams_result)
    
    res = await get_sla_settings_admin(db)
    assert res.pause_on_hold is True
    assert res.pause_statuses == ["on_hold"]
    assert len(res.teams) == 2
    assert res.teams[0].name == "Team A"
    assert res.teams[1].name == "Team B"


@pytest.mark.asyncio
async def test_update_sla_settings_admin_invalid_statuses() -> None:
    db = AsyncMock()
    settings_row = SlaSettings(
        id=uuid.uuid4(),
        pause_on_hold=True,
        pause_statuses=["on_hold"],
        trigger_team_ids=[],
        sla_starts_on_team_assignment=False,
        due_soon_minutes=60,
    )
    db.get = AsyncMock(return_value=settings_row)
    
    payload = SlaSettingsUpdate(pause_statuses=["", "   "])
    with pytest.raises(HTTPException) as exc_info:
        await update_sla_settings_admin(db, payload)
    assert exc_info.value.status_code == 400
    assert "Mindst én status skal pause SLA" in exc_info.value.detail


@pytest.mark.asyncio
async def test_update_sla_settings_admin_success() -> None:
    db = AsyncMock()
    settings_row = SlaSettings(
        id=uuid.uuid4(),
        pause_on_hold=True,
        pause_statuses=["on_hold"],
        trigger_team_ids=[],
        sla_starts_on_team_assignment=False,
        due_soon_minutes=60,
    )
    db.get = AsyncMock(return_value=settings_row)
    
    mock_teams_result = MagicMock()
    mock_teams_result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=mock_teams_result)
    
    payload = SlaSettingsUpdate(
        pause_on_hold=False,
        pause_statuses=["paused", "on_hold"],
        due_soon_minutes=30,
    )
    res = await update_sla_settings_admin(db, payload)
    assert res.pause_on_hold is False
    assert res.pause_statuses == ["paused", "on_hold"]
    assert res.due_soon_minutes == 30
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(settings_row)


@pytest.mark.asyncio
async def test_update_sla_settings_admin_no_pause_statuses() -> None:
    db = AsyncMock()
    settings_row = SlaSettings(
        id=uuid.uuid4(),
        pause_on_hold=True,
        pause_statuses=["on_hold"],
        trigger_team_ids=[],
        sla_starts_on_team_assignment=False,
        due_soon_minutes=60,
    )
    db.get = AsyncMock(return_value=settings_row)
    
    mock_teams_result = MagicMock()
    mock_teams_result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=mock_teams_result)
    
    payload = SlaSettingsUpdate(
        pause_on_hold=False,
        due_soon_minutes=30,
    )
    res = await update_sla_settings_admin(db, payload)
    assert res.pause_on_hold is False
    assert res.due_soon_minutes == 30
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(settings_row)

