"""Persist per-user workspace landing widget layout."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.user import User
from star_itsm_api.models.workspace_layout import WORKSPACE_LAYOUT_VERSION, UserWorkspaceLayout
from star_itsm_api.schemas.workspace_layout import (
    WORKSPACE_WIDGET_KINDS,
    WorkspaceLandingLayout,
    WorkspaceLandingRead,
    WorkspaceLandingUpdate,
    WorkspaceWidgetInstance,
)

DEFAULT_WORKSPACE_LAYOUT = WorkspaceLandingLayout(
    personal=[
        WorkspaceWidgetInstance(
            instance_id="personal-dashboard-0",
            kind="personal-dashboard",
            order=0,
            span="full",
            hidden=False,
        ),
        WorkspaceWidgetInstance(
            instance_id="dispatch-queue-1",
            kind="dispatch-queue",
            order=1,
            span="full",
            hidden=False,
        ),
        WorkspaceWidgetInstance(
            instance_id="personal-notes-2",
            kind="personal-notes",
            order=2,
            span="half",
            hidden=False,
        ),
        WorkspaceWidgetInstance(
            instance_id="personal-kanban-3",
            kind="personal-kanban",
            order=3,
            span="half",
            hidden=False,
        ),
        WorkspaceWidgetInstance(
            instance_id="my-tickets-4",
            kind="my-tickets",
            order=4,
            span="full",
            hidden=False,
        ),
    ],
    team=[
        WorkspaceWidgetInstance(
            instance_id="team-dashboard-0",
            kind="team-dashboard",
            order=0,
            span="full",
            hidden=False,
        ),
        WorkspaceWidgetInstance(
            instance_id="team-chat-1",
            kind="team-chat",
            order=1,
            span="half",
            hidden=False,
        ),
        WorkspaceWidgetInstance(
            instance_id="team-members-2",
            kind="team-members",
            order=2,
            span="half",
            hidden=False,
        ),
        WorkspaceWidgetInstance(
            instance_id="team-dispatch-3",
            kind="team-dispatch",
            order=3,
            span="full",
            hidden=False,
        ),
    ],
)


def _normalize_instances(
    instances: list[WorkspaceWidgetInstance],
) -> list[WorkspaceWidgetInstance]:
    visible = [item for item in instances if not item.hidden]
    visible.sort(key=lambda item: item.order)
    return [
        item.model_copy(update={"order": index})
        for index, item in enumerate(visible)
    ] + [item for item in instances if item.hidden]


def normalize_layout(layout: WorkspaceLandingLayout) -> WorkspaceLandingLayout:
    return WorkspaceLandingLayout(
        personal=_normalize_instances(layout.personal),
        team=_normalize_instances(layout.team),
    )


def layout_to_storage(layout: WorkspaceLandingLayout) -> dict:
    normalized = normalize_layout(layout)
    return normalized.model_dump()


def layout_from_storage(raw: dict | None) -> WorkspaceLandingLayout:
    if not raw or not isinstance(raw, dict):
        return DEFAULT_WORKSPACE_LAYOUT.model_copy(deep=True)
    try:
        parsed = WorkspaceLandingLayout.model_validate(raw)
    except ValueError:
        return DEFAULT_WORKSPACE_LAYOUT.model_copy(deep=True)
    if not parsed.personal and not parsed.team:
        return DEFAULT_WORKSPACE_LAYOUT.model_copy(deep=True)
    return normalize_layout(parsed)


def _to_read(row: UserWorkspaceLayout) -> WorkspaceLandingRead:
    return WorkspaceLandingRead(
        user_id=row.user_id,
        layout=layout_from_storage(row.layout),
        layout_version=row.layout_version,
        updated_at=row.updated_at,
    )


async def get_workspace_landing(
    db: AsyncSession,
    user: User,
) -> WorkspaceLandingRead:
    result = await db.execute(
        select(UserWorkspaceLayout).where(UserWorkspaceLayout.user_id == user.id),
    )
    row = result.scalar_one_or_none()
    if row is None:
        return WorkspaceLandingRead(
            user_id=user.id,
            layout=DEFAULT_WORKSPACE_LAYOUT.model_copy(deep=True),
            layout_version=WORKSPACE_LAYOUT_VERSION,
            updated_at=datetime.now(UTC),
        )
    return _to_read(row)


async def save_workspace_landing(
    db: AsyncSession,
    user: User,
    payload: WorkspaceLandingUpdate,
) -> WorkspaceLandingRead:
    layout = normalize_layout(payload.layout)
    for space_key, instances in (("personal", layout.personal), ("team", layout.team)):
        for instance in instances:
            if instance.kind not in WORKSPACE_WIDGET_KINDS:
                msg = f"Unknown widget kind '{instance.kind}' in {space_key}"
                raise ValueError(msg)

    storage = layout_to_storage(layout)
    result = await db.execute(
        select(UserWorkspaceLayout).where(UserWorkspaceLayout.user_id == user.id),
    )
    row = result.scalar_one_or_none()
    now = datetime.now(UTC)
    if row is None:
        row = UserWorkspaceLayout(
            user_id=user.id,
            layout=storage,
            layout_version=WORKSPACE_LAYOUT_VERSION,
            created_at=now,
            updated_at=now,
        )
        db.add(row)
    else:
        row.layout = storage
        row.layout_version = WORKSPACE_LAYOUT_VERSION
        row.updated_at = now
    await db.commit()
    await db.refresh(row)
    return _to_read(row)


async def reset_workspace_landing(
    db: AsyncSession,
    user: User,
) -> WorkspaceLandingRead:
    return await save_workspace_landing(
        db,
        user,
        WorkspaceLandingUpdate(layout=DEFAULT_WORKSPACE_LAYOUT.model_copy(deep=True)),
    )
