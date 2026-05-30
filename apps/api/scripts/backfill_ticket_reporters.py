#!/usr/bin/env python3
"""Backfill tickets whose reporter_user_id does not resolve to an active user.

Usage (from apps/api with DATABASE_URL set):
    python scripts/backfill_ticket_reporters.py [--dry-run]

Assigns orphaned reporters to, in order:
1. assigned_user_id when set and valid
2. actor from earliest ticket.created event
3. SYSTEM user (00000000-0000-0000-0000-000000000001)
"""

from __future__ import annotations

import argparse
import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.constants import SYSTEM_USER_ID
from star_itsm_api.db import async_session_factory
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.models.user import User


async def _valid_user_ids(db: AsyncSession) -> set[uuid.UUID]:
    rows = await db.execute(select(User.id).where(User.deleted_at.is_(None)))
    return {row[0] for row in rows.all()}


async def _creator_from_events(db: AsyncSession, ticket_id: uuid.UUID) -> uuid.UUID | None:
    result = await db.execute(
        select(TicketEvent.actor_user_id)
        .where(
            TicketEvent.ticket_id == ticket_id,
            TicketEvent.event_type == "ticket.created",
        )
        .order_by(TicketEvent.created_at.asc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return row


async def backfill(*, dry_run: bool) -> int:
    if async_session_factory is None:
        raise SystemExit("DATABASE_URL is not configured")

    updated = 0
    async with async_session_factory() as db:
        valid_ids = await _valid_user_ids(db)
        if SYSTEM_USER_ID not in valid_ids:
            print("WARNING: system user missing from users table")

        tickets = await db.execute(
            select(Ticket).where(Ticket.deleted_at.is_(None))
        )
        for ticket in tickets.scalars().all():
            if ticket.reporter_user_id in valid_ids:
                continue

            replacement: uuid.UUID | None = None
            if ticket.assigned_user_id and ticket.assigned_user_id in valid_ids:
                replacement = ticket.assigned_user_id
            else:
                creator = await _creator_from_events(db, ticket.id)
                if creator and creator in valid_ids:
                    replacement = creator

            if replacement is None:
                replacement = SYSTEM_USER_ID

            print(
                f"{ticket.ticket_number}: reporter {ticket.reporter_user_id} "
                f"→ {replacement}"
            )
            if not dry_run:
                ticket.reporter_user_id = replacement
                updated += 1

        if not dry_run and updated:
            await db.commit()

    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill orphaned ticket reporters")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print changes without writing to the database",
    )
    args = parser.parse_args()
    count = asyncio.run(backfill(dry_run=args.dry_run))
    if args.dry_run:
        print("Dry run complete (no writes).")
    else:
        print(f"Updated {count} ticket(s).")


if __name__ == "__main__":
    main()
