"""Bulk-tildeling af kategori til sager uden category_id."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.category import Category, Subcategory
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services.category_defaults import (
    DEFAULT_FILL_CATEGORY_NAME,
    DEFAULT_FILL_SUBCATEGORY_NAME,
)
from star_itsm_api.services.sla import apply_sla_to_ticket
from star_itsm_api.services.ticket_timestamps import touch_ticket_updated


@dataclass(frozen=True)
class CategoryFillResult:
    ticket_count: int
    updated_count: int
    dry_run: bool
    category_name: str
    subcategory_name: str


async def _resolve_fill_targets(
    db: AsyncSession,
    *,
    category_name: str,
    subcategory_name: str,
) -> tuple[Category, Subcategory]:
    category = (
        await db.execute(
            select(Category).where(Category.name == category_name, Category.is_active.is_(True))
        )
    ).scalar_one_or_none()
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aktiv kategori '{category_name}' findes ikke — kør synkronisering først",
        )
    subcategory = (
        await db.execute(
            select(Subcategory).where(
                Subcategory.category_id == category.id,
                Subcategory.name == subcategory_name,
                Subcategory.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    if subcategory is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aktiv underkategori '{subcategory_name}' findes ikke under {category_name}",
        )
    return category, subcategory


async def fill_tickets_missing_category(
    db: AsyncSession,
    *,
    dry_run: bool = False,
    category_name: str = DEFAULT_FILL_CATEGORY_NAME,
    subcategory_name: str = DEFAULT_FILL_SUBCATEGORY_NAME,
    recalculate_sla: bool = True,
) -> CategoryFillResult:
    category, subcategory = await _resolve_fill_targets(
        db,
        category_name=category_name,
        subcategory_name=subcategory_name,
    )
    tickets = (
        (
            await db.execute(
                select(Ticket).where(
                    Ticket.deleted_at.is_(None),
                    Ticket.category_id.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    count = len(tickets)
    if dry_run:
        return CategoryFillResult(
            ticket_count=count,
            updated_count=0,
            dry_run=True,
            category_name=category.name,
            subcategory_name=subcategory.name,
        )

    now = datetime.now(UTC)
    for ticket in tickets:
        ticket.category_id = category.id
        ticket.subcategory_id = subcategory.id
        if recalculate_sla:
            await apply_sla_to_ticket(db, ticket, start_at=ticket.created_at)
        touch_ticket_updated(ticket, now)

    await db.commit()
    return CategoryFillResult(
        ticket_count=count,
        updated_count=count,
        dry_run=False,
        category_name=category.name,
        subcategory_name=subcategory.name,
    )
