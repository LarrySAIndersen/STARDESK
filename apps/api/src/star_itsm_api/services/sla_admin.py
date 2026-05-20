from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.sla import SlaPolicy
from star_itsm_api.schemas.sla_admin import SlaPolicyRead, SlaPolicyUpdate, SlaStandardRuleRead
from star_itsm_api.services.sla_config import STANDARD_SLA_RULES


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
        response_time_minutes=p.response_time_minutes,
        resolution_time_minutes=p.resolution_time_minutes,
        business_hours_only=p.business_hours_only,
        is_active=p.is_active,
    )
