import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import (
    ROLE_AGENT,
    ROLE_SUBMITTER,
    get_current_user,
    is_staff,
    require_staff,
)
from star_itsm_api.services.permissions import can_manage_users, is_admin, is_staff_role
from star_itsm_api.deps import require_db
from star_itsm_api.models.comment import TicketComment
from star_itsm_api.models.team import Team
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.models.user import User
from star_itsm_api.schemas.attachment import AttachmentRead
from star_itsm_api.schemas.comment import (
    CommentCreate,
    CommentReactionSummary,
    CommentReactionUpdate,
    CommentRead,
)
from star_itsm_api.services.comment_reactions import (
    apply_reaction_summaries,
    load_reaction_summaries,
    set_comment_reaction,
)
from star_itsm_api.schemas.slack import SlackPushRequest, SlackPushResponse
from star_itsm_api.schemas.ticket import (
    CLOSED_STATUSES,
    TicketAssignmentUpdate,
    TicketCreate,
    TicketDetailRead,
    TicketMetadataUpdate,
    TicketParentUpdate,
    TicketPriorityUpdate,
    TicketRead,
    TicketRelatedMajorCreate,
    TicketStatusUpdate,
)
from star_itsm_api.services.slack_mock import get_mock_channel
from star_itsm_api.services.ticket_hierarchy import (
    HierarchyValidationError,
    add_related_major_link,
    remove_related_major_link,
    set_parent_ticket_id,
)
from star_itsm_api.services.sub_causes import (
    replace_ticket_sub_causes,
    validate_sub_cause_ids,
)
from star_itsm_api.services.ticket_read import ticket_to_detail_read, ticket_to_read, tickets_to_read_list
from star_itsm_api.services.dashboard_scope import (
    apply_dashboard_scope_stmt,
    parse_dashboard_scope,
)
from star_itsm_api.services.org_access import (
    apply_agent_team_list_filter,
    apply_ticket_list_filter,
    can_assign_to_any_team,
    get_user_organization_id,
    user_can_access_ticket,
)
from star_itsm_api.services.ticket_dashboard_filters import (
    apply_bucket_filter,
    filter_tickets_by_sla,
    filter_tickets_closed_since,
    filter_tickets_opened_since,
)
from star_itsm_api.services.routing import apply_routing
from star_itsm_api.services.sla import apply_sla_to_ticket
from star_itsm_api.services.teams import user_in_team
from star_itsm_api.services.reports import is_reopen_transition
from star_itsm_api.models.attachment import Attachment
from star_itsm_api.services.attachments import (
    list_ticket_attachments_for_detail,
    resolve_download_path,
    save_ticket_upload,
)
from star_itsm_api.services.ticket_numbers import generate_ticket_number
from star_itsm_api.services.knowledge_articles import exclude_knowledge_articles
from star_itsm_api.services.ticket_search import apply_ticket_search_filter
from star_itsm_api.services.ticket_sort import (
    DEFAULT_TICKET_SORT,
    apply_ticket_sort,
    parse_ticket_sort,
)
from star_itsm_api.services.ticket_security import (
    require_staff_for_security_metadata_update,
    resolve_create_security_flag,
)
from star_itsm_api.services.ticket_activity import build_ticket_activity, ticket_timestamps_read
from star_itsm_api.services.ticket_privacy import ticket_sensitive_fields
from star_itsm_api.services.ticket_timestamps import (
    apply_status_milestone_timestamps,
    maybe_set_assigned_at,
    maybe_set_first_response,
    touch_ticket_updated,
)
from star_itsm_api.schemas.ticket_intelligence import (
    TicketIntelligenceRead,
    TicketIntelligenceUpdate,
    TicketLlmContextRead,
    TicketLlmEvalPackRead,
)
from star_itsm_api.services.ticket_intelligence import (
    EVALUATION_RUBRIC_DA,
    build_ticket_llm_context,
    build_llm_context_batch,
    intelligence_from_ticket,
)
from star_itsm_api.services.ticket_routing import intake_metadata_from_answers

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tickets", tags=["tickets"])


async def _ensure_ticket_access(
    db: AsyncSession,
    ticket: Ticket,
    user: User,
) -> None:
    if not await user_can_access_ticket(db, user, ticket):
        raise HTTPException(status_code=404, detail="Ticket not found")


async def _assignment_names(
    db: AsyncSession,
    ticket: Ticket,
) -> tuple[str | None, str | None]:
    team_name: str | None = None
    user_name: str | None = None
    if ticket.assigned_team_id:
        team = await db.get(Team, ticket.assigned_team_id)
        team_name = team.name if team else None
    if ticket.assigned_user_id:
        assignee = await db.get(User, ticket.assigned_user_id)
        user_name = assignee.display_name if assignee else None
    return team_name, user_name


async def _comment_to_read(
    db: AsyncSession,
    comment: TicketComment,
    *,
    hide_internal: bool,
) -> CommentRead | None:
    if hide_internal and comment.is_internal:
        return None
    author = await db.get(User, comment.author_user_id)
    visibility = "internal" if comment.is_internal else "external"
    return CommentRead(
        id=comment.id,
        body=comment.body,
        is_internal=comment.is_internal,
        visibility=visibility,
        visibility_label_da="Intern" if comment.is_internal else "Ekstern (kundeportal)",
        author_display_name=author.display_name if author else "Ukendt",
        created_at=comment.created_at,
    )


@router.get("", response_model=list[TicketRead])
async def list_tickets(
    board: bool = Query(
        default=False,
        description="Full org ticket list for dispatch board (staff only)",
    ),
    major_open: bool = Query(
        default=False,
        description="Open major incidents for agent banner (staff only)",
    ),
    store_sager: bool = Query(
        default=False,
        description="Store sager only (slutbruger portal)",
    ),
    q: str | None = Query(
        default=None,
        max_length=100,
        description="Search title, description, sagsnr. or tags",
    ),
    parent_id: uuid.UUID | None = Query(
        default=None,
        description="Filter child tickets of a store sag",
    ),
    has_parent: bool | None = Query(
        default=None,
        description="True = små sager only; False = tickets without parent",
    ),
    is_store: bool | None = Query(
        default=None,
        description="True = store sager (is_major, no parent)",
    ),
    security_only: bool = Query(
        default=False,
        description="Only security tickets (sikkerhedssager)",
    ),
    open_only: bool = Query(
        default=False,
        description="Exclude resolved/closed/cancelled tickets",
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
        description="Maximum tickets returned (newest first)",
    ),
    assignee_id: uuid.UUID | None = Query(
        default=None,
        description="Filter tickets assigned to this user (user management)",
    ),
    scope: str | None = Query(
        default=None,
        description="personal, mine, group, created, all — dashboard drill-down scope",
    ),
    bucket: str | None = Query(
        default=None,
        description="Pipeline bucket: modtaget, igangsat, lost, lukket",
    ),
    sla: str | None = Query(
        default=None,
        description="SLA filter on open tickets: overdue, due_soon",
    ),
    opened_since_days: int | None = Query(
        default=None,
        ge=1,
        le=365,
        description="Tickets created within N days",
    ),
    closed_since_days: int | None = Query(
        default=None,
        ge=1,
        le=365,
        description="Tickets closed/resolved within N days",
    ),
    sort: str = Query(
        default=DEFAULT_TICKET_SORT,
        description=(
            "Sort order: created_desc, created_asc, priority_desc, "
            "sla_asc, ticket_number_asc, title_asc"
        ),
    ),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> list[TicketRead]:
    try:
        if assignee_id is not None and not can_manage_users(current_user):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        parsed_scope = parse_dashboard_scope(scope)
        if scope is not None and parsed_scope is None:
            raise HTTPException(status_code=400, detail="Invalid scope")
        if sla is not None and sla not in ("overdue", "due_soon"):
            raise HTTPException(status_code=400, detail="Invalid sla filter")
        try:
            parsed_sort = parse_ticket_sort(sort)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid sort") from None

        stmt = select(Ticket).where(Ticket.deleted_at.is_(None))
        stmt = exclude_knowledge_articles(stmt)
        stmt = apply_ticket_list_filter(stmt, current_user, store_sager=store_sager)
        if assignee_id is not None:
            stmt = stmt.where(Ticket.assigned_user_id == assignee_id)
        effective_scope = parsed_scope
        dashboard_filters = (
            effective_scope is not None
            or bucket is not None
            or sla is not None
            or opened_since_days is not None
            or closed_since_days is not None
        )
        if effective_scope is not None and is_staff_role(current_user):
            stmt = await apply_dashboard_scope_stmt(
                db, stmt, current_user, effective_scope
            )
        elif effective_scope is not None:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        if bucket is not None:
            if not is_staff_role(current_user):
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            stmt = apply_bucket_filter(stmt, bucket)
        if parent_id is not None:
            stmt = stmt.where(Ticket.parent_ticket_id == parent_id)
        if has_parent is True:
            stmt = stmt.where(Ticket.parent_ticket_id.is_not(None))
        elif has_parent is False:
            stmt = stmt.where(Ticket.parent_ticket_id.is_(None))
        if is_store is True:
            stmt = stmt.where(
                Ticket.is_major.is_(True),
                Ticket.parent_ticket_id.is_(None),
            )
        elif is_store is False:
            stmt = stmt.where(
                (Ticket.is_major.is_(False)) | (Ticket.parent_ticket_id.is_not(None))
            )
        if board:
            if not is_staff_role(current_user):
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            open_only = True
            limit = min(limit, 500)
        elif major_open:
            if not is_staff_role(current_user):
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            stmt = stmt.where(Ticket.is_major.is_(True))
            stmt = stmt.where(Ticket.status.notin_(tuple(CLOSED_STATUSES)))
        elif store_sager and current_user.role != ROLE_SUBMITTER:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        elif current_user.role == ROLE_AGENT and not dashboard_filters:
            stmt = await apply_agent_team_list_filter(db, stmt, current_user)
        if security_only:
            stmt = stmt.where(Ticket.is_security_ticket.is_(True))
        if open_only:
            stmt = stmt.where(Ticket.status.notin_(tuple(CLOSED_STATUSES)))
        stmt = apply_ticket_search_filter(stmt, q)
        stmt = apply_ticket_sort(stmt, parsed_sort).limit(limit)
        result = await db.execute(stmt)
        tickets = list(result.scalars().all())
        if sla is not None:
            tickets = filter_tickets_by_sla(tickets, sla=sla)
        if opened_since_days is not None:
            tickets = filter_tickets_opened_since(tickets, days=opened_since_days)
        if closed_since_days is not None:
            tickets = filter_tickets_closed_since(tickets, days=closed_since_days)
        return await tickets_to_read_list(db, tickets)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to list tickets")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Could not load tickets") from None


@router.get("/llm-eval-pack", response_model=TicketLlmEvalPackRead)
async def get_llm_eval_pack(
    board: bool = Query(
        default=True,
        description="Use dispatch-board ticket scope for agents",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    open_only: bool = Query(default=True, description="Exclude closed/cancelled"),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketLlmEvalPackRead:
    """Batch LLM-ready context for semantic + ease evaluation."""
    stmt = select(Ticket).where(Ticket.deleted_at.is_(None))
    stmt = apply_ticket_list_filter(stmt, current_user)
    if board:
        pass
    elif current_user.role == ROLE_AGENT:
        stmt = await apply_agent_team_list_filter(db, stmt, current_user)
    if open_only:
        stmt = stmt.where(Ticket.status.notin_(tuple(CLOSED_STATUSES)))
    stmt = stmt.order_by(Ticket.created_at.desc())
    offset = (page - 1) * page_size
    result = await db.execute(stmt.offset(offset).limit(page_size))
    tickets = list(result.scalars().all())
    items = await build_llm_context_batch(db, tickets)
    return TicketLlmEvalPackRead(
        evaluation_rubric_da=EVALUATION_RUBRIC_DA,
        count=len(items),
        items=items,
    )


@router.post("", response_model=TicketRead, status_code=201)
async def create_ticket(
    payload: TicketCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> TicketRead:
    routing = await apply_routing(
        db,
        ticket_type=payload.ticket_type,
        category_id=payload.category_id,
        subcategory_id=payload.subcategory_id,
        priority=payload.priority,
    )
    await validate_sub_cause_ids(
        db,
        payload.sub_cause_ids,
        category_id=payload.category_id,
    )
    is_security_ticket = resolve_create_security_flag(
        current_user,
        payload.is_security_ticket,
    )
    if payload.parent_ticket_id is not None and payload.is_major:
        raise HTTPException(
            status_code=400,
            detail="Store sager cannot have a parent ticket",
        )
    now = datetime.now(UTC)
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number=await generate_ticket_number(db, payload.ticket_type),
        ticket_type=payload.ticket_type,
        title=payload.title,
        description=payload.description,
        status="assigned" if routing.assigned_team_id else "new",
        priority=routing.priority,
        reporter_user_id=current_user.id,
        organization_id=get_user_organization_id(current_user),
        assigned_team_id=routing.assigned_team_id,
        assigned_user_id=routing.assigned_user_id,
        category_id=payload.category_id,
        subcategory_id=payload.subcategory_id,
        source="portal",
        escalation_level=0,
        gdpr_consent=payload.gdpr_consent,
        gdpr_consent_at=now if payload.gdpr_consent else None,
        subject_cpr=payload.subject_cpr,
        is_major=payload.is_major,
        is_security_ticket=is_security_ticket,
        parent_ticket_id=None,
        tags=payload.tags,
        emoji=payload.emoji,
        routing_metadata=intake_metadata_from_answers(payload.intake_answers),
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    db.add(ticket)
    await apply_sla_to_ticket(
        db,
        ticket,
        priority=routing.priority,
        start_at=now,
    )
    await db.flush()
    if payload.parent_ticket_id is not None:
        try:
            await set_parent_ticket_id(db, ticket, payload.parent_ticket_id)
        except HierarchyValidationError as exc:
            await db.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    if ticket.status == "assigned":
        maybe_set_assigned_at(ticket, now=now)
    if payload.sub_cause_ids:
        await replace_ticket_sub_causes(db, ticket.id, payload.sub_cause_ids)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=current_user.id,
            event_type="ticket.created",
            payload={"ticket_number": ticket.ticket_number},
            created_at=now,
        )
    )
    await db.commit()
    await db.refresh(ticket)
    return await ticket_to_read(db, ticket)


@router.get("/{ticket_id}", response_model=TicketDetailRead)
async def get_ticket(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> TicketDetailRead:
    try:
        return await _get_ticket_detail(db, ticket_id, current_user)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to load ticket %s", ticket_id)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Could not load ticket") from None


async def _get_ticket_detail(
    db: AsyncSession,
    ticket_id: uuid.UUID,
    current_user: User,
) -> TicketDetailRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)

    comments_result = await db.execute(
        select(TicketComment)
        .where(
            TicketComment.ticket_id == ticket_id,
            TicketComment.deleted_at.is_(None),
        )
        .order_by(TicketComment.created_at.asc())
    )
    hide_internal = current_user.role == ROLE_SUBMITTER
    comments: list[CommentRead] = []
    for comment in comments_result.scalars().all():
        read = await _comment_to_read(db, comment, hide_internal=hide_internal)
        if read is not None:
            comments.append(read)
    comment_ids = [c.id for c in comments]
    try:
        reaction_map = await load_reaction_summaries(
            db,
            comment_ids,
            current_user_id=current_user.id,
        )
    except Exception:
        logger.warning("Could not load comment reactions for ticket %s", ticket_id, exc_info=True)
        reaction_map = {}
    comments = apply_reaction_summaries(comments, reaction_map)

    team_name, user_name = await _assignment_names(db, ticket)
    attachments = await list_ticket_attachments_for_detail(
        db,
        ticket_id,
        current_user,
        reporter_user_id=ticket.reporter_user_id,
    )
    activity = await build_ticket_activity(db, ticket, current_user)
    intelligence = None
    if is_staff(current_user):
        try:
            intelligence = intelligence_from_ticket(ticket)
        except Exception:
            logger.warning(
                "Could not build intelligence for ticket %s",
                ticket_id,
                exc_info=True,
            )
    return await ticket_to_detail_read(
        db,
        ticket,
        extra={
            "intelligence": intelligence,
            "description": ticket.description,
            "category_id": ticket.category_id,
            "subcategory_id": ticket.subcategory_id,
            "assigned_team_id": ticket.assigned_team_id,
            "assigned_team_name": team_name,
            "assigned_user_id": ticket.assigned_user_id,
            "assigned_user_name": user_name,
            "response_due_at": ticket.response_due_at,
            "resolution_due_at": ticket.resolution_due_at,
            "escalation_level": ticket.escalation_level,
            "assignment_reason": ticket.assignment_reason,
            "fault_displayed": ticket.fault_displayed,
            "attachments": attachments,
            "comments": comments,
            "timestamps": ticket_timestamps_read(ticket),
            "activity": activity,
            **ticket_sensitive_fields(ticket, current_user),
        },
    )


@router.post("/{ticket_id}/attachments", response_model=AttachmentRead, status_code=201)
async def upload_ticket_attachment(
    ticket_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
):
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)
    if not is_staff(current_user) and current_user.id != ticket.reporter_user_id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    now = datetime.now(UTC)
    read = await save_ticket_upload(db, ticket_id=ticket_id, user=current_user, upload=file)
    touch_ticket_updated(ticket, now)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket_id,
            actor_user_id=current_user.id,
            event_type="ticket.attachment.uploaded",
            payload={
                "attachment_id": str(read.id),
                "filename": read.filename,
                "scan_status": read.scan_status,
            },
            created_at=now,
        )
    )
    await db.commit()
    return read


@router.get("/{ticket_id}/attachments/{attachment_id}/download")
async def download_ticket_attachment(
    ticket_id: uuid.UUID,
    attachment_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    if not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)

    attachment = await db.get(Attachment, attachment_id)
    if attachment is None or attachment.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Attachment not found")

    path = resolve_download_path(attachment)
    return FileResponse(
        path,
        media_type=attachment.content_type,
        filename=attachment.filename,
    )


@router.patch("/{ticket_id}", response_model=TicketRead)
async def update_ticket_status(
    ticket_id: uuid.UUID,
    payload: TicketStatusUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)

    previous_status = ticket.status
    now = datetime.now(UTC)
    ticket.status = payload.status
    apply_status_milestone_timestamps(ticket, payload.status, now=now)

    event_type = "ticket.status_changed"
    if is_reopen_transition(previous_status, payload.status):
        event_type = "ticket.reopened"

    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=current_user.id,
            event_type=event_type,
            payload={
                "status": payload.status,
                "previous_status": previous_status,
            },
            created_at=now,
        )
    )
    await db.commit()
    await db.refresh(ticket)
    return await ticket_to_read(db, ticket)


@router.patch("/{ticket_id}/metadata", response_model=TicketDetailRead)
async def update_ticket_metadata(
    ticket_id: uuid.UUID,
    payload: TicketMetadataUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> TicketDetailRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)

    updates = payload.model_dump(exclude_unset=True)
    require_staff_for_security_metadata_update(current_user, updates)
    if "is_major" in updates and updates["is_major"] is not None:
        ticket.is_major = updates["is_major"]
        if ticket.is_major:
            ticket.parent_ticket_id = None
    if "is_shared" in updates and updates["is_shared"] is not None:
        ticket.is_shared = updates["is_shared"]
    if "is_security_ticket" in updates and updates["is_security_ticket"] is not None:
        ticket.is_security_ticket = updates["is_security_ticket"]
    if "parent_ticket_id" in updates:
        try:
            await set_parent_ticket_id(db, ticket, updates["parent_ticket_id"])
        except HierarchyValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    if "sub_cause_ids" in updates:
        sub_cause_ids = updates["sub_cause_ids"] or []
        await validate_sub_cause_ids(
            db,
            sub_cause_ids,
            category_id=ticket.category_id,
        )
        await replace_ticket_sub_causes(db, ticket.id, sub_cause_ids)
    if "tags" in updates and updates["tags"] is not None:
        ticket.tags = updates["tags"]
    if "emoji" in updates:
        ticket.emoji = updates["emoji"]

    if updates:
        now = datetime.now(UTC)
        touch_ticket_updated(ticket, now)
        db.add(
            TicketEvent(
                id=uuid.uuid4(),
                ticket_id=ticket.id,
                actor_user_id=current_user.id,
                event_type="ticket.metadata_changed",
                payload={"fields": list(updates.keys())},
                created_at=now,
            )
        )
    await db.commit()
    return await get_ticket(ticket_id, db, current_user)


@router.patch("/{ticket_id}/priority", response_model=TicketDetailRead)
async def update_ticket_priority(
    ticket_id: uuid.UUID,
    payload: TicketPriorityUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketDetailRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)

    previous_priority = ticket.priority
    if payload.priority == previous_priority:
        raise HTTPException(
            status_code=400,
            detail="Prioritet er uændret; angiv en ny prioritet for at gemme.",
        )

    reason = payload.reason.strip()
    if len(reason) < 10:
        raise HTTPException(
            status_code=400,
            detail="Begrundelse skal være mindst 10 tegn.",
        )

    now = datetime.now(UTC)
    ticket.priority = payload.priority
    await apply_sla_to_ticket(
        db,
        ticket,
        priority=payload.priority,
        start_at=ticket.created_at,
    )
    touch_ticket_updated(ticket, now)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=current_user.id,
            event_type="ticket.priority_changed",
            payload={
                "priority": payload.priority,
                "previous_priority": previous_priority,
                "reason": reason,
            },
            created_at=now,
        )
    )
    await db.commit()
    return await get_ticket(ticket_id, db, current_user)


@router.post("/{ticket_id}/slack-push", response_model=SlackPushResponse)
async def push_ticket_to_slack(
    ticket_id: uuid.UUID,
    payload: SlackPushRequest,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> SlackPushResponse:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)

    channel = get_mock_channel(payload.channel_id)
    if channel is None:
        raise HTTPException(status_code=400, detail="Ukendt Slack-kanal")

    now = datetime.now(UTC)
    touch_ticket_updated(ticket, now)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=current_user.id,
            event_type="ticket.slack_pushed",
            payload={
                "channel_id": channel["channel_id"],
                "channel_name": channel["name"],
                "mock": True,
            },
            created_at=now,
        )
    )
    await db.commit()
    return SlackPushResponse(
        channel_id=channel["channel_id"],
        channel_name=channel["name"],
        mock=True,
    )


@router.patch("/{ticket_id}/parent", response_model=TicketDetailRead)
async def update_ticket_parent(
    ticket_id: uuid.UUID,
    payload: TicketParentUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketDetailRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)
    try:
        await set_parent_ticket_id(db, ticket, payload.parent_ticket_id)
    except HierarchyValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    now = datetime.now(UTC)
    touch_ticket_updated(ticket, now)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=current_user.id,
            event_type="ticket.parent_changed",
            payload={
                "parent_ticket_id": str(payload.parent_ticket_id)
                if payload.parent_ticket_id
                else None,
            },
            created_at=now,
        )
    )
    await db.commit()
    return await get_ticket(ticket_id, db, current_user)


@router.post(
    "/{ticket_id}/related-majors",
    response_model=TicketDetailRead,
    status_code=201,
)
async def link_related_major_ticket(
    ticket_id: uuid.UUID,
    payload: TicketRelatedMajorCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketDetailRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)
    if not ticket.is_major or ticket.parent_ticket_id is not None:
        raise HTTPException(status_code=400, detail="Only store sager can link to other store sager")
    try:
        await add_related_major_link(
            db,
            ticket_id=ticket_id,
            related_ticket_id=payload.related_ticket_id,
        )
    except HierarchyValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    now = datetime.now(UTC)
    touch_ticket_updated(ticket, now)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=current_user.id,
            event_type="ticket.related_major_linked",
            payload={"related_ticket_id": str(payload.related_ticket_id)},
            created_at=now,
        )
    )
    await db.commit()
    return await get_ticket(ticket_id, db, current_user)


@router.delete("/{ticket_id}/related-majors/{related_ticket_id}", status_code=204)
async def unlink_related_major_ticket(
    ticket_id: uuid.UUID,
    related_ticket_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> None:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)
    removed = await remove_related_major_link(
        db,
        ticket_id=ticket_id,
        related_ticket_id=related_ticket_id,
    )
    if not removed:
        raise HTTPException(status_code=404, detail="Link not found")
    now = datetime.now(UTC)
    touch_ticket_updated(ticket, now)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=current_user.id,
            event_type="ticket.related_major_unlinked",
            payload={"related_ticket_id": str(related_ticket_id)},
            created_at=now,
        )
    )
    await db.commit()


@router.patch("/{ticket_id}/assignment", response_model=TicketDetailRead)
async def assign_ticket(
    ticket_id: uuid.UUID,
    payload: TicketAssignmentUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketDetailRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)

    updates = payload.model_dump(exclude_unset=True)
    team_id = ticket.assigned_team_id
    user_id = ticket.assigned_user_id
    if "assigned_team_id" in updates:
        team_id = updates["assigned_team_id"]
    if "assigned_user_id" in updates:
        user_id = updates["assigned_user_id"]

    if team_id is not None:
        team = await db.get(Team, team_id)
        if team is None or not team.is_active:
            raise HTTPException(status_code=400, detail="Invalid group")
        if current_user.role == ROLE_AGENT and not can_assign_to_any_team(current_user):
            if not await user_in_team(db, current_user.id, team_id):
                raise HTTPException(status_code=403, detail="Not a member of this group")

    if user_id is not None:
        assignee = await db.get(User, user_id)
        if assignee is None or assignee.deleted_at is not None or not assignee.is_active:
            raise HTTPException(status_code=400, detail="Invalid user")
        if assignee.role == ROLE_SUBMITTER:
            raise HTTPException(status_code=400, detail="Cannot assign to submitter")
        if not is_admin(current_user):
            actor_org = get_user_organization_id(current_user)
            assignee_org = get_user_organization_id(assignee)
            if actor_org is not None and assignee_org != actor_org:
                raise HTTPException(status_code=400, detail="User is not in your organization")
        if team_id is not None and not await user_in_team(db, user_id, team_id):
            raise HTTPException(
                status_code=400,
                detail="User is not a member of the selected group",
            )

    previous = {
        "assigned_team_id": str(ticket.assigned_team_id) if ticket.assigned_team_id else None,
        "assigned_user_id": str(ticket.assigned_user_id) if ticket.assigned_user_id else None,
    }
    ticket.assigned_team_id = team_id
    ticket.assigned_user_id = user_id
    if "assignment_reason" in updates:
        ticket.assignment_reason = updates["assignment_reason"]
    if "fault_displayed" in updates and updates["fault_displayed"] is not None:
        ticket.fault_displayed = updates["fault_displayed"]
    now = datetime.now(UTC)
    if ticket.status == "new" and (team_id or user_id):
        ticket.status = "assigned"
        apply_status_milestone_timestamps(ticket, "assigned", now=now)
    maybe_set_assigned_at(ticket, now=now)

    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=current_user.id,
            event_type="ticket.assigned",
            payload={
                "previous": previous,
                "assigned_team_id": str(team_id) if team_id else None,
                "assigned_user_id": str(user_id) if user_id else None,
                "assignment_reason": ticket.assignment_reason,
                "fault_displayed": ticket.fault_displayed,
            },
            created_at=now,
        )
    )
    await db.commit()
    await db.refresh(ticket)
    return await get_ticket(ticket_id, db, current_user)


@router.get("/{ticket_id}/llm-context", response_model=TicketLlmContextRead)
async def get_ticket_llm_context(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketLlmContextRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)
    return await build_ticket_llm_context(db, ticket)


@router.patch("/{ticket_id}/intelligence", response_model=TicketIntelligenceRead)
async def update_ticket_intelligence(
    ticket_id: uuid.UUID,
    payload: TicketIntelligenceUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketIntelligenceRead:
    """Persist LLM or manual triage metadata (e.g. after external evaluation)."""
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)
    updates = payload.model_dump(exclude_unset=True)
    if "semantic_topics" in updates and updates["semantic_topics"] is not None:
        ticket.semantic_topics = [t.strip().lower() for t in updates["semantic_topics"] if t.strip()]
    if "ease_score" in updates:
        ticket.ease_score = updates["ease_score"]
    if "complexity_score" in updates:
        ticket.complexity_score = updates["complexity_score"]
    if "llm_summary" in updates:
        ticket.llm_summary = updates["llm_summary"]
    if "handling_hints" in updates and updates["handling_hints"] is not None:
        ticket.handling_hints = [h.strip() for h in updates["handling_hints"] if h.strip()]
    if "source" in updates:
        ticket.intelligence_source = updates["source"]
    elif updates:
        ticket.intelligence_source = "manual"
    now = datetime.now(UTC)
    ticket.intelligence_updated_at = now
    touch_ticket_updated(ticket, now)
    await db.commit()
    await db.refresh(ticket)
    return intelligence_from_ticket(ticket)


@router.post("/{ticket_id}/comments", response_model=CommentRead, status_code=201)
async def create_comment(
    ticket_id: uuid.UUID,
    payload: CommentCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> CommentRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)

    if is_staff(current_user):
        is_internal = (
            payload.visibility == "internal"
            if payload.visibility is not None
            else payload.is_internal
        )
    else:
        is_internal = False

    now = datetime.now(UTC)
    comment = TicketComment(
        id=uuid.uuid4(),
        ticket_id=ticket_id,
        author_user_id=current_user.id,
        body=payload.body,
        is_internal=is_internal,
        created_at=now,
        deleted_at=None,
    )
    db.add(comment)
    maybe_set_first_response(
        ticket,
        is_staff=is_staff(current_user),
        is_internal=is_internal,
        now=now,
    )
    touch_ticket_updated(ticket, now)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket_id,
            actor_user_id=current_user.id,
            event_type="comment.created",
            payload={"comment_id": str(comment.id), "is_internal": is_internal},
            created_at=now,
        )
    )
    await db.commit()
    await db.refresh(comment)
    read = await _comment_to_read(db, comment, hide_internal=False)
    assert read is not None
    summaries = await load_reaction_summaries(db, [read.id], current_user_id=current_user.id)
    enriched = apply_reaction_summaries([read], summaries)
    return enriched[0]


@router.put(
    "/{ticket_id}/comments/{comment_id}/reactions",
    response_model=CommentReactionSummary,
)
async def upsert_comment_reaction(
    ticket_id: uuid.UUID,
    comment_id: uuid.UUID,
    payload: CommentReactionUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> CommentReactionSummary:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await _ensure_ticket_access(db, ticket, current_user)

    comment = await db.get(TicketComment, comment_id)
    if comment is None or comment.deleted_at is not None or comment.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if current_user.role == ROLE_SUBMITTER and comment.is_internal:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    summary = await set_comment_reaction(
        db,
        comment_id=comment_id,
        user_id=current_user.id,
        sentiment=payload.sentiment,
    )
    await db.commit()
    return summary
