from dataclasses import dataclass
from datetime import UTC, datetime
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.sla import SlaAssignment, SlaPolicy
from star_itsm_api.services.sla_calendar import add_sla_duration
from star_itsm_api.services.sla_config import SlaRule, get_sla_rule
from star_itsm_api.services.sla_settings_store import get_sla_runtime_settings, sla_applies_to_team


@dataclass
class SlaDueDates:
    sla_policy_id: uuid.UUID | None
    response_due_at: datetime | None
    resolution_due_at: datetime | None


def compute_sla_due_dates_sync(
    priority: str,
    start_at: datetime,
) -> tuple[datetime, datetime]:
    """Compute response and resolution due from priority and anchor time."""
    rule = get_sla_rule(priority)
    if start_at.tzinfo is None:
        start_at = start_at.replace(tzinfo=UTC)
    response_due = add_sla_duration(
        start_at,
        kind=rule.response_kind,
        amount=rule.response_amount,
    )
    resolution_due = add_sla_duration(
        start_at,
        kind=rule.resolution_kind,
        amount=rule.resolution_amount,
    )
    return response_due, resolution_due


def compute_sla_due_dates_for_rule(rule: SlaRule, start_at: datetime) -> SlaDueDates:
    response_due, resolution_due = compute_sla_due_dates_sync(rule.priority, start_at)
    return SlaDueDates(
        sla_policy_id=None,
        response_due_at=response_due,
        resolution_due_at=resolution_due,
    )


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

    rule = get_sla_rule(priority)
    fallback = await db.execute(
        select(SlaPolicy)
        .where(SlaPolicy.name == rule.policy_name, SlaPolicy.is_active.is_(True))
        .limit(1)
    )
    return fallback.scalar_one_or_none()


async def compute_sla_due_dates(
    db: AsyncSession,
    *,
    priority: str,
    category_id: uuid.UUID | None,
    subcategory_id: uuid.UUID | None,
    start_at: datetime | None = None,
) -> SlaDueDates:
    policy = await _resolve_policy(db, priority, category_id, subcategory_id)
    anchor = start_at or datetime.now(UTC)
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=UTC)
    response_due, resolution_due = compute_sla_due_dates_sync(priority, anchor)
    return SlaDueDates(
        sla_policy_id=policy.id if policy else None,
        response_due_at=response_due,
        resolution_due_at=resolution_due,
    )


async def apply_sla_to_ticket(
    db: AsyncSession,
    ticket: object,
    *,
    priority: str | None = None,
    start_at: datetime | None = None,
    force: bool = False,
) -> None:
    """Set SLA fields on a ticket model (create or priority change)."""
    if not force:
        runtime = await get_sla_runtime_settings(db)
        if runtime.sla_starts_on_team_assignment and getattr(ticket, "assigned_team_id", None) is None:
            return
        if runtime.trigger_team_ids and not sla_applies_to_team(ticket, runtime):  # type: ignore[arg-type]
            return

    effective_priority = priority or getattr(ticket, "priority", "medium")
    category_id = getattr(ticket, "category_id", None)
    subcategory_id = getattr(ticket, "subcategory_id", None)
    anchor = start_at or getattr(ticket, "created_at", None) or datetime.now(UTC)
    sla = await compute_sla_due_dates(
        db,
        priority=effective_priority,
        category_id=category_id,
        subcategory_id=subcategory_id,
        start_at=anchor,
    )
    ticket.sla_policy_id = sla.sla_policy_id  # type: ignore[attr-defined]
    ticket.response_due_at = sla.response_due_at  # type: ignore[attr-defined]
    ticket.resolution_due_at = sla.resolution_due_at  # type: ignore[attr-defined]
