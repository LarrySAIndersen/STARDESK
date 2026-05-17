from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.sla import SlaAssignment, SlaPolicy


@dataclass
class SlaDueDates:
    sla_policy_id: uuid.UUID | None
    response_due_at: datetime | None
    resolution_due_at: datetime | None


async def _resolve_policy(
    db: AsyncSession,
    priority: str,
    category_id: uuid.UUID | None,
    subcategory_id: uuid.UUID | None,
) -> SlaPolicy | None:
    assignments = (
        await db.execute(
            select(SlaAssignment, SlaPolicy)
            .join(SlaPolicy, SlaAssignment.sla_policy_id == SlaPolicy.id)
            .where(
                SlaAssignment.priority == priority,
                SlaPolicy.is_active.is_(True),
            )
        )
    ).all()

    best: SlaPolicy | None = None
    best_score = -1
    for assignment, policy in assignments:
        score = 0
        if assignment.subcategory_id:
            if assignment.subcategory_id != subcategory_id:
                continue
            score += 4
        if assignment.category_id:
            if assignment.category_id != category_id:
                continue
            score += 2
        if score > best_score:
            best_score = score
            best = policy

    if best is not None:
        return best

    fallback = await db.execute(
        select(SlaPolicy).where(SlaPolicy.name == "Medium", SlaPolicy.is_active.is_(True)).limit(1)
    )
    return fallback.scalar_one_or_none()


async def compute_sla_due_dates(
    db: AsyncSession,
    *,
    priority: str,
    category_id: uuid.UUID | None,
    subcategory_id: uuid.UUID | None,
) -> SlaDueDates:
    policy = await _resolve_policy(db, priority, category_id, subcategory_id)
    if policy is None:
        return SlaDueDates(None, None, None)

    now = datetime.now(UTC)
    return SlaDueDates(
        sla_policy_id=policy.id,
        response_due_at=now + timedelta(minutes=policy.response_time_minutes),
        resolution_due_at=now + timedelta(minutes=policy.resolution_time_minutes),
    )
