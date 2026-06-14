"""Recurring Wreck ind tasks — schedule templates and spawn tickets."""

from __future__ import annotations

import calendar
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.constants import SYSTEM_USER_ID, WRECK_IND_TICKET_TYPE
from star_itsm_api.models.recurring_task import RecurringTask
from star_itsm_api.models.team import Team
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.models.user import User
from star_itsm_api.schemas.recurring_task import (
    RecurringTaskCreate,
    RecurringTaskRead,
    RecurringTaskUpdate,
)
from star_itsm_api.services.org_access import get_user_organization_id
from star_itsm_api.services.sla import apply_sla_to_ticket
from star_itsm_api.services.ticket_numbers import generate_ticket_number
from star_itsm_api.services.ticket_source import resolve_ticket_source_on_create
from star_itsm_api.services.ticket_timestamps import maybe_set_assigned_at, touch_ticket_updated

ScheduleUnit = Literal["minute", "hour", "day", "week", "month"]


def schedule_label_da(unit: str, interval: int) -> str:
    if interval == 1:
        singular = {
            "minute": "minut",
            "hour": "time",
            "day": "dag",
            "week": "uge",
            "month": "måned",
        }.get(unit, unit)
        return f"Hver {singular}"
    plural = {
        "minute": "minutter",
        "hour": "timer",
        "day": "dage",
        "week": "uger",
        "month": "måneder",
    }.get(unit, f"{unit}er")
    return f"Hver {interval}. {plural}"


def add_schedule_interval(
    start: datetime,
    *,
    unit: ScheduleUnit,
    interval: int,
) -> datetime:
    if unit == "minute":
        return start + timedelta(minutes=interval)
    if unit == "hour":
        return start + timedelta(hours=interval)
    if unit == "day":
        return start + timedelta(days=interval)
    if unit == "week":
        return start + timedelta(weeks=interval)
    month_index = start.month - 1 + interval
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    day = min(start.day, last_day)
    return start.replace(year=year, month=month, day=day)


async def _team_name(db: AsyncSession, team_id: uuid.UUID | None) -> str | None:
    if team_id is None:
        return None
    team = await db.get(Team, team_id)
    return team.name if team else None


async def _user_display_name(db: AsyncSession, user_id: uuid.UUID | None) -> str | None:
    if user_id is None:
        return None
    user = await db.get(User, user_id)
    return user.display_name if user else None


async def _ticket_number(db: AsyncSession, ticket_id: uuid.UUID | None) -> str | None:
    if ticket_id is None:
        return None
    ticket = await db.get(Ticket, ticket_id)
    return ticket.ticket_number if ticket else None


async def recurring_task_to_read(db: AsyncSession, task: RecurringTask) -> RecurringTaskRead:
    return RecurringTaskRead(
        id=task.id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        category_id=task.category_id,
        subcategory_id=task.subcategory_id,
        assigned_team_id=task.assigned_team_id,
        assigned_team_name=await _team_name(db, task.assigned_team_id),
        assigned_user_id=task.assigned_user_id,
        assigned_user_name=await _user_display_name(db, task.assigned_user_id),
        schedule_unit=task.schedule_unit,
        schedule_interval=task.schedule_interval,
        schedule_label_da=schedule_label_da(task.schedule_unit, task.schedule_interval),
        next_run_at=task.next_run_at,
        last_run_at=task.last_run_at,
        last_ticket_id=task.last_ticket_id,
        last_ticket_number=await _ticket_number(db, task.last_ticket_id),
        is_active=task.is_active,
        created_by_user_id=task.created_by_user_id,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


async def list_recurring_tasks(db: AsyncSession) -> list[RecurringTaskRead]:
    rows = (
        (
            await db.execute(
                select(RecurringTask)
                .where(RecurringTask.deleted_at.is_(None))
                .order_by(RecurringTask.is_active.desc(), RecurringTask.next_run_at.asc())
            )
        )
        .scalars()
        .all()
    )
    return [await recurring_task_to_read(db, row) for row in rows]


async def create_recurring_task(
    db: AsyncSession,
    *,
    current_user: User,
    payload: RecurringTaskCreate,
) -> RecurringTaskRead:
    if payload.assigned_team_id is None and payload.assigned_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vælg mindst én ansvarlig gruppe eller bruger",
        )
    now = datetime.now(UTC)
    start_at = payload.start_at if payload.start_at is not None else now
    if start_at.tzinfo is None:
        start_at = start_at.replace(tzinfo=UTC)
    task = RecurringTask(
        id=uuid.uuid4(),
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        category_id=payload.category_id,
        subcategory_id=payload.subcategory_id,
        assigned_team_id=payload.assigned_team_id,
        assigned_user_id=payload.assigned_user_id,
        schedule_unit=payload.schedule_unit,
        schedule_interval=payload.schedule_interval,
        next_run_at=start_at,
        last_run_at=None,
        last_ticket_id=None,
        is_active=payload.is_active,
        created_by_user_id=current_user.id,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return await recurring_task_to_read(db, task)


async def update_recurring_task(
    db: AsyncSession,
    *,
    task_id: uuid.UUID,
    payload: RecurringTaskUpdate,
) -> RecurringTaskRead:
    task = await db.get(RecurringTask, task_id)
    if task is None or task.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opgave ikke fundet")

    updates = payload.model_dump(exclude_unset=True)
    if "assigned_team_id" in updates or "assigned_user_id" in updates:
        team_id = updates.get("assigned_team_id", task.assigned_team_id)
        user_id = updates.get("assigned_user_id", task.assigned_user_id)
        if team_id is None and user_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vælg mindst én ansvarlig gruppe eller bruger",
            )

    for field, value in updates.items():
        setattr(task, field, value)
    task.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(task)
    return await recurring_task_to_read(db, task)


async def delete_recurring_task(db: AsyncSession, *, task_id: uuid.UUID) -> None:
    task = await db.get(RecurringTask, task_id)
    if task is None or task.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opgave ikke fundet")
    now = datetime.now(UTC)
    task.deleted_at = now
    task.is_active = False
    task.updated_at = now
    await db.commit()


async def _create_ticket_from_recurring_task(
    db: AsyncSession,
    *,
    task: RecurringTask,
    reporter: User,
    now: datetime,
) -> Ticket:
    assigned_team_id = task.assigned_team_id
    assigned_user_id = task.assigned_user_id
    status_value = "assigned" if assigned_team_id or assigned_user_id else "new"
    resolved_source = resolve_ticket_source_on_create(is_staff_user=True, requested="api")
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number=await generate_ticket_number(db, WRECK_IND_TICKET_TYPE),
        ticket_type=WRECK_IND_TICKET_TYPE,
        title=task.title,
        description=task.description,
        status=status_value,
        priority=task.priority,
        reporter_user_id=reporter.id,
        organization_id=get_user_organization_id(reporter),
        assigned_team_id=assigned_team_id,
        assigned_user_id=assigned_user_id,
        category_id=task.category_id,
        subcategory_id=task.subcategory_id,
        source=resolved_source,
        escalation_level=0,
        gdpr_consent=False,
        gdpr_consent_at=None,
        subject_cpr=None,
        is_major=False,
        is_security_ticket=False,
        parent_ticket_id=None,
        tags=[],
        emoji=None,
        routing_metadata={"recurring_task_id": str(task.id)},
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    db.add(ticket)
    await apply_sla_to_ticket(db, ticket, priority=task.priority, start_at=now)
    await db.flush()
    if status_value == "assigned":
        maybe_set_assigned_at(ticket, now=now)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=reporter.id,
            event_type="ticket.created",
            payload={
                "ticket_number": ticket.ticket_number,
                "source": resolved_source,
                "recurring_task_id": str(task.id),
            },
            created_at=now,
        )
    )
    return ticket


async def run_due_recurring_tasks(db: AsyncSession, *, now: datetime | None = None) -> int:
    """Create tickets for all due recurring tasks. Returns count of tickets created."""
    run_at = now or datetime.now(UTC)
    due = (
        (
            await db.execute(
                select(RecurringTask).where(
                    RecurringTask.deleted_at.is_(None),
                    RecurringTask.is_active.is_(True),
                    RecurringTask.next_run_at <= run_at,
                )
            )
        )
        .scalars()
        .all()
    )

    created = 0
    for task in due:
        reporter = await db.get(User, task.created_by_user_id)
        if reporter is None:
            reporter = await db.get(User, SYSTEM_USER_ID)
        if reporter is None:
            continue

        ticket = await _create_ticket_from_recurring_task(
            db,
            task=task,
            reporter=reporter,
            now=run_at,
        )
        task.last_run_at = run_at
        task.last_ticket_id = ticket.id
        task.next_run_at = add_schedule_interval(
            run_at,
            unit=task.schedule_unit,  # type: ignore[arg-type]
            interval=task.schedule_interval,
        )
        touch_ticket_updated(ticket, run_at)
        task.updated_at = run_at
        created += 1

    if created:
        await db.commit()
    return created
