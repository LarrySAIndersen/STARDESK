import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.constants import PRIORITY_ORDER
from star_itsm_api.models.routing_rule import RoutingRule


@dataclass
class RoutingResult:
    assigned_team_id: uuid.UUID | None
    assigned_user_id: uuid.UUID | None
    priority: str


async def apply_routing(
    db: AsyncSession,
    *,
    ticket_type: str,
    category_id: uuid.UUID | None,
    subcategory_id: uuid.UUID | None,
    priority: str,
) -> RoutingResult:
    rules = (
        (
            await db.execute(
                select(RoutingRule)
                .where(RoutingRule.is_active.is_(True))
                .order_by(RoutingRule.priority_order.asc())
            )
        )
        .scalars()
        .all()
    )

    for rule in rules:
        if rule.ticket_type and rule.ticket_type != ticket_type:
            continue
        if rule.category_id and rule.category_id != category_id:
            continue
        if rule.subcategory_id and rule.subcategory_id != subcategory_id:
            continue
        if rule.min_priority and PRIORITY_ORDER[priority] < PRIORITY_ORDER[rule.min_priority]:
            continue
        return RoutingResult(
            assigned_team_id=rule.assign_team_id,
            assigned_user_id=rule.assign_user_id,
            priority=rule.set_priority or priority,
        )

    # No rule match: leave unassigned so the ticket enters the distribution queue.
    return RoutingResult(
        assigned_team_id=None,
        assigned_user_id=None,
        priority=priority,
    )
