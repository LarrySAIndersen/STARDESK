import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.sub_cause import SubCause, TicketSubCause
from star_itsm_api.schemas.sub_cause import SubCauseRead


async def list_sub_causes(
    db: AsyncSession,
    *,
    category_id: uuid.UUID | None = None,
) -> list[SubCauseRead]:
    stmt = select(SubCause).where(SubCause.is_active.is_(True)).order_by(SubCause.sort_order.asc())
    if category_id is not None:
        stmt = stmt.where(
            (SubCause.category_id == category_id) | (SubCause.category_id.is_(None))
        )
    result = await db.execute(stmt)
    return [SubCauseRead.model_validate(row) for row in result.scalars().all()]


async def get_sub_causes_by_ticket_ids(
    db: AsyncSession,
    ticket_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[SubCauseRead]]:
    if not ticket_ids:
        return {}
    result = await db.execute(
        select(TicketSubCause.ticket_id, SubCause)
        .join(SubCause, TicketSubCause.sub_cause_id == SubCause.id)
        .where(TicketSubCause.ticket_id.in_(ticket_ids), SubCause.is_active.is_(True))
        .order_by(SubCause.sort_order.asc())
    )
    mapping: dict[uuid.UUID, list[SubCauseRead]] = {tid: [] for tid in ticket_ids}
    for ticket_id, sub_cause in result.all():
        mapping[ticket_id].append(SubCauseRead.model_validate(sub_cause))
    return mapping


async def validate_sub_cause_ids(
    db: AsyncSession,
    sub_cause_ids: list[uuid.UUID],
    *,
    category_id: uuid.UUID | None,
) -> None:
    if not sub_cause_ids:
        return
    result = await db.execute(
        select(SubCause).where(
            SubCause.id.in_(sub_cause_ids),
            SubCause.is_active.is_(True),
        )
    )
    found = {row.id: row for row in result.scalars().all()}
    if len(found) != len(set(sub_cause_ids)):
        raise HTTPException(status_code=400, detail="Invalid sub-cause")
    if category_id is not None:
        for sub_cause in found.values():
            if sub_cause.category_id is not None and sub_cause.category_id != category_id:
                raise HTTPException(
                    status_code=400,
                    detail="Sub-cause does not match selected category",
                )


async def replace_ticket_sub_causes(
    db: AsyncSession,
    ticket_id: uuid.UUID,
    sub_cause_ids: list[uuid.UUID],
) -> None:
    await db.execute(delete(TicketSubCause).where(TicketSubCause.ticket_id == ticket_id))
    for sub_cause_id in sub_cause_ids:
        db.add(
            TicketSubCause(
                ticket_id=ticket_id,
                sub_cause_id=sub_cause_id,
                created_at=datetime.now(UTC),
            )
        )
