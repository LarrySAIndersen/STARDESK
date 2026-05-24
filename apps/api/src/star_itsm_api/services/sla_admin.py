from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.sla import SlaPolicy
from star_itsm_api.models.team import Team
from star_itsm_api.schemas.sla_admin import (
    SlaPolicyRead,
    SlaPolicyUpdate,
    SlaSettingsRead,
    SlaSettingsUpdate,
    SlaStandardRuleRead,
    SlaTeamOptionRead,
)
from star_itsm_api.services.sla_config import STANDARD_SLA_RULES
from star_itsm_api.services.sla_settings_store import get_sla_settings_row


async def list_sla_policies(db: AsyncSession) -> list[SlaPolicyRead]:
    rows = (
        await db.execute(select(SlaPolicy).order_by(SlaPolicy.name.asc()))
    ).scalars().all()
    return [
        SlaPolicyRead(
            id=p.id,
            name=p.name,
            description=getattr(p, "description", None),
            response_time_minutes=p.response_time_minutes,
            resolution_time_minutes=p.resolution_time_minutes,
            business_hours_only=p.business_hours_only,
            is_active=p.is_active,
        )
        for p in rows
    ]


def list_standard_sla_rules() -> list[SlaStandardRuleRead]:
    return [
        SlaStandardRuleRead(
            priority=rule.priority,
            label_da=rule.label_da,
            policy_name=rule.policy_name,
            response_kind=rule.response_kind,
            response_amount=rule.response_amount,
            resolution_kind=rule.resolution_kind,
            resolution_amount=rule.resolution_amount,
        )
        for rule in STANDARD_SLA_RULES.values()
    ]


async def update_sla_policy(
    db: AsyncSession,
    policy_id: UUID,
    payload: SlaPolicyUpdate,
) -> SlaPolicyRead:
    policy = await db.get(SlaPolicy, policy_id)
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SLA-politik ikke fundet")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        if hasattr(policy, key):
            setattr(policy, key, value)

    await db.commit()
    await db.refresh(policy)
    return SlaPolicyRead(
        id=policy.id,
        name=policy.name,
        description=getattr(policy, "description", None),
        response_time_minutes=policy.response_time_minutes,
        resolution_time_minutes=policy.resolution_time_minutes,
        business_hours_only=policy.business_hours_only,
        is_active=policy.is_active,
    )


async def _list_active_teams(db: AsyncSession) -> list[SlaTeamOptionRead]:
    rows = (
        await db.execute(select(Team).where(Team.is_active.is_(True)).order_by(Team.name.asc()))
    ).scalars().all()
    return [SlaTeamOptionRead(id=t.id, name=t.name) for t in rows]


async def get_sla_settings_admin(db: AsyncSession) -> SlaSettingsRead:
    row = await get_sla_settings_row(db)
    teams = await _list_active_teams(db)
    return SlaSettingsRead(
        pause_on_hold=row.pause_on_hold,
        pause_statuses=list(row.pause_statuses or ["on_hold"]),
        trigger_team_ids=list(row.trigger_team_ids or []),
        sla_starts_on_team_assignment=row.sla_starts_on_team_assignment,
        due_soon_minutes=row.due_soon_minutes,
        teams=teams,
    )


async def update_sla_settings_admin(
    db: AsyncSession,
    payload: SlaSettingsUpdate,
) -> SlaSettingsRead:
    row = await get_sla_settings_row(db)
    updates = payload.model_dump(exclude_unset=True)
    if "pause_statuses" in updates and updates["pause_statuses"] is not None:
        normalized = [s.strip() for s in updates["pause_statuses"] if s.strip()]
        if not normalized:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mindst én status skal pause SLA",
            )
        updates["pause_statuses"] = normalized
    for key, value in updates.items():
        setattr(row, key, value)
    row.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(row)
    return await get_sla_settings_admin(db)
