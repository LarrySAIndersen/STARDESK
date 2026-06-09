import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.config import settings
from star_itsm_api.core.http_details import INSUFFICIENT_PERMISSIONS, TICKET_NOT_FOUND
from star_itsm_api.core.security import (
    ROLE_AGENT,
    ROLE_SUBMITTER,
    get_current_user,
    is_staff,
    require_staff,
)
from star_itsm_api.deps import require_db
from star_itsm_api.models.attachment import Attachment
from star_itsm_api.models.comment import TicketComment
from star_itsm_api.models.team import Team
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.models.ticket_stakeholder import TicketStakeholder
from star_itsm_api.models.user import User
from star_itsm_api.schemas.attachment import AttachmentRead
from star_itsm_api.schemas.comment import (
    CommentCreate,
    CommentReactionSummary,
    CommentReactionUpdate,
    CommentRead,
)
from star_itsm_api.schemas.slack import SlackPushRequest, SlackPushResponse
from star_itsm_api.schemas.stakeholder import (
    TicketStakeholderCreate,
    TicketStakeholderRead,
    TicketStakeholdersGroupedRead,
    TicketStakeholderUpdate,
)
from star_itsm_api.schemas.ticket import (
    CLOSED_STATUSES,
    TicketAssignmentUpdate,
    TicketCreate,
    TicketDetailRead,
    TicketEmailReplyRequest,
    TicketMetadataUpdate,
    TicketParentUpdate,
    TicketPriorityUpdate,
    TicketRead,
    TicketRelatedMajorCreate,
    TicketStatusUpdate,
    TicketTypeUpdate,
)
from star_itsm_api.schemas.ticket_intake_assist import IntakeAssistRequest, IntakeAssistResponse
from star_itsm_api.schemas.ticket_intelligence import (
    TicketIntelligenceRead,
    TicketIntelligenceUpdate,
    TicketLlmContextRead,
    TicketLlmEvalPackRead,
)
from star_itsm_api.services.attachments import (
    build_attachment_download_response,
    delete_ticket_attachment,
    list_ticket_attachments_for_detail,
    save_ticket_upload,
)
from star_itsm_api.services.comment_reactions import (
    apply_reaction_summaries,
    load_reaction_summaries,
    set_comment_reaction,
)
from star_itsm_api.services.db_resilience import optional_db_read
from star_itsm_api.services.gmail import GmailApiError, list_ticket_emails, send_ticket_email_reply
from star_itsm_api.services.gmail import get_email_integration as get_gmail_integration
from star_itsm_api.services.org_access import (
    apply_agent_team_list_filter,
    apply_ticket_list_filter,
    can_assign_to_any_team,
    get_user_organization_id,
    user_can_access_ticket,
)
from star_itsm_api.services.permissions import is_admin
from star_itsm_api.services.reports import is_reopen_transition
from star_itsm_api.services.routing import apply_routing, get_sf_service_desk_team_id
from star_itsm_api.services.sla import apply_sla_to_ticket
from star_itsm_api.services.sla_pause import (
    maybe_start_sla_on_assignment,
    sync_sla_pause_on_status_change,
)
from star_itsm_api.services.sla_settings_store import get_sla_runtime_settings
from star_itsm_api.services.slack import SlackApiError, get_slack_integration, post_ticket_message
from star_itsm_api.services.slack_mock import get_mock_channel
from star_itsm_api.services.sub_causes import (
    replace_ticket_sub_causes,
    validate_sub_cause_ids,
)
from star_itsm_api.services.teams import user_in_team
from star_itsm_api.services.ticket_activity import build_ticket_activity, ticket_timestamps_read
from star_itsm_api.services.ticket_assignment import resolve_ticket_assignment
from star_itsm_api.services.ticket_classification import (
    validate_ticket_classification,
    validate_ticket_source_value,
)
from star_itsm_api.services.ticket_hierarchy import (
    HierarchyValidationError,
    add_related_major_link,
    broadcast_comment_to_children,
    count_children,
    is_store_sag,
    remove_related_major_link,
    set_parent_ticket_id,
)
from star_itsm_api.services.ticket_intake_assist import build_intake_assist_draft
from star_itsm_api.services.ticket_intelligence import (
    EVALUATION_RUBRIC_DA,
    build_llm_context_batch,
    build_ticket_llm_context,
    intelligence_from_ticket,
)
from star_itsm_api.services.ticket_list_query import (
    apply_list_tickets_post_filters,
    build_list_tickets_stmt,
    validate_list_tickets_query,
)
from star_itsm_api.services.ticket_notifications import (
    build_assignment_notification,
    build_comment_notification,
    build_priority_notification,
    build_status_notification,
    notify_reporter_of_ticket_update,
)
from star_itsm_api.services.ticket_numbers import generate_ticket_number
from star_itsm_api.services.ticket_privacy import ticket_sensitive_fields
from star_itsm_api.services.ticket_read import (
    load_user_display_names,
    resolve_reporter_display_name,
    ticket_to_detail_read,
    ticket_to_read,
    tickets_to_read_list,
)
from star_itsm_api.services.ticket_routing import intake_metadata_from_answers
from star_itsm_api.services.ticket_security import (
    require_staff_for_security_metadata_update,
    resolve_create_security_flag,
)
from star_itsm_api.services.ticket_sort import DEFAULT_TICKET_SORT
from star_itsm_api.services.ticket_source import resolve_ticket_source_on_create
from star_itsm_api.services.ticket_stakeholders import (
    get_ticket_stakeholders_grouped,
    process_comment_mentions,
    soft_delete_stakeholder,
    stakeholder_to_read,
    sync_role_stakeholders,
    sync_ticket_stakeholders_on_create,
    upsert_stakeholder,
    validate_stakeholder_user_ids,
)
from star_itsm_api.services.ticket_timestamps import (
    apply_status_milestone_timestamps,
    maybe_set_assigned_at,
    maybe_set_first_response,
    touch_ticket_updated,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tickets", tags=["tickets"])


async def _ensure_ticket_access(
    db: AsyncSession,
    ticket: Ticket,
    user: User,
) -> None:
    if not await user_can_access_ticket(db, user, ticket):
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)


async def _apply_metadata_classification(
    db: AsyncSession,
    ticket: Ticket,
    updates: dict,
    current_user: User,
) -> None:
    if "category_id" not in updates and "subcategory_id" not in updates:
        return
    if not is_staff(current_user):
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS)
    next_category_id = updates.get("category_id", ticket.category_id)
    next_subcategory_id = updates.get("subcategory_id", ticket.subcategory_id)
    await validate_ticket_classification(
        db,
        category_id=next_category_id,
        subcategory_id=next_subcategory_id,
    )
    ticket.category_id = next_category_id
    ticket.subcategory_id = next_subcategory_id


async def _sync_metadata_stakeholders(
    db: AsyncSession,
    ticket: Ticket,
    updates: dict,
    current_user: User,
    now: datetime,
) -> None:
    for field, role in (("affected_user_ids", "affected"), ("interested_user_ids", "interested")):
        if field not in updates or updates[field] is None:
            continue
        if not is_staff(current_user):
            raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS)
        await validate_stakeholder_user_ids(db, updates[field])
        await sync_role_stakeholders(
            db,
            ticket_id=ticket.id,
            role=role,
            user_ids=updates[field],
            now=now,
        )


async def _apply_ticket_metadata_updates(
    db: AsyncSession,
    ticket: Ticket,
    updates: dict,
    current_user: User,
) -> None:
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
        await validate_sub_cause_ids(db, sub_cause_ids, category_id=ticket.category_id)
        await replace_ticket_sub_causes(db, ticket.id, sub_cause_ids)
    if "tags" in updates and updates["tags"] is not None:
        ticket.tags = updates["tags"]
    if "emoji" in updates:
        ticket.emoji = updates["emoji"]
    await _apply_metadata_classification(db, ticket, updates, current_user)
    if "source" in updates and updates["source"] is not None:
        if not is_staff(current_user):
            raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS)
        validate_ticket_source_value(updates["source"])
        ticket.source = updates["source"]
    stakeholder_now = datetime.now(UTC)
    try:
        await _sync_metadata_stakeholders(db, ticket, updates, current_user, stakeholder_now)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


async def _validate_assignment_targets(
    db: AsyncSession,
    current_user: User,
    team_id: uuid.UUID | None,
    user_id: uuid.UUID | None,
) -> None:
    if team_id is not None:
        team = await db.get(Team, team_id)
        if team is None or not team.is_active:
            raise HTTPException(status_code=400, detail="Invalid group")
        if (
            current_user.role == ROLE_AGENT
            and not can_assign_to_any_team(current_user)
            and not await user_in_team(db, current_user.id, team_id)
        ):
            raise HTTPException(status_code=403, detail="Not a member of this group")

    if user_id is None:
        return
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
        raise HTTPException(status_code=400, detail="User is not a member of the selected group")


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
    author_names: dict[uuid.UUID, str] | None = None,
) -> CommentRead | None:
    if hide_internal and comment.is_internal:
        return None
    if author_names is None:
        author_names = await load_user_display_names(db, {comment.author_user_id})
    visibility = "internal" if comment.is_internal else "external"
    return CommentRead(
        id=comment.id,
        body=comment.body,
        is_internal=comment.is_internal,
        visibility=visibility,
        visibility_label_da="Intern" if comment.is_internal else "Ekstern (kundeportal)",
        author_display_name=author_names.get(comment.author_user_id, "Ukendt"),
        created_at=comment.created_at,
    )


async def _comments_to_read(
    db: AsyncSession,
    comments: list[TicketComment],
    *,
    hide_internal: bool,
) -> list[CommentRead]:
    visible = [c for c in comments if not (hide_internal and c.is_internal)]
    if not visible:
        return []
    author_names = await load_user_display_names(
        db,
        {comment.author_user_id for comment in visible},
    )
    reads: list[CommentRead] = []
    for comment in visible:
        visibility = "internal" if comment.is_internal else "external"
        reads.append(
            CommentRead(
                id=comment.id,
                body=comment.body,
                is_internal=comment.is_internal,
                visibility=visibility,
                visibility_label_da="Intern" if comment.is_internal else "Ekstern (kundeportal)",
                author_display_name=author_names.get(comment.author_user_id, "Ukendt"),
                created_at=comment.created_at,
            )
        )
    return reads


@router.get("")
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
    assigned_team_id: uuid.UUID | None = Query(
        default=None,
        description="Filter tickets assigned to this team (dashboard drill-down)",
    ),
    ticket_type: str | None = Query(
        default=None,
        description="Filter by ticket type: incident, problem, service_request, etc.",
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
    status: str | None = Query(
        default=None,
        description="Exact ticket status (dashboard drill-down)",
    ),
    priority: str | None = Query(
        default=None,
        description="Ticket priority: critical, high, medium, low",
    ),
    created_on: str | None = Query(
        default=None,
        description="Tickets created on calendar day (YYYY-MM-DD)",
    ),
    closed_on: str | None = Query(
        default=None,
        description="Tickets closed/resolved on calendar day (YYYY-MM-DD)",
    ),
    sort: str = Query(
        default=DEFAULT_TICKET_SORT,
        description=(
            "Sort order: created_desc, created_asc, priority_desc, "
            "sla_asc, ticket_number_asc, title_asc"
        ),
    ),
    stakeholder: str | None = Query(
        default=None,
        description="Use 'me' for tickets you created or where you are a stakeholder",
    ),
    involving_user_id: uuid.UUID | None = Query(
        default=None,
        description="Filter tickets involving this user (reporter or stakeholder)",
    ),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> list[TicketRead]:
    try:
        parsed = validate_list_tickets_query(
            current_user=current_user,
            assignee_id=assignee_id,
            involving_user_id=involving_user_id,
            stakeholder=stakeholder,
            scope=scope,
            sla=sla,
            priority=priority,
            ticket_type=ticket_type,
            created_on=created_on,
            closed_on=closed_on,
            sort=sort,
            open_only=open_only,
            limit=limit,
        )
        stmt = await build_list_tickets_stmt(
            db,
            current_user,
            parsed,
            store_sager=store_sager,
            assignee_id=assignee_id,
            assigned_team_id=assigned_team_id,
            bucket=bucket,
            parent_id=parent_id,
            has_parent=has_parent,
            is_store=is_store,
            board=board,
            major_open=major_open,
            security_only=security_only,
            sla=sla,
            opened_since_days=opened_since_days,
            closed_since_days=closed_since_days,
            status=status,
            priority=priority,
            ticket_type=ticket_type,
            q=q,
            stakeholder=stakeholder,
            involving_user_id=involving_user_id,
        )
        result = await db.execute(stmt)
        tickets = list(result.scalars().all())
        tickets = apply_list_tickets_post_filters(
            tickets,
            parsed,
            sla=sla,
            opened_since_days=opened_since_days,
            closed_since_days=closed_since_days,
        )
        return await tickets_to_read_list(db, tickets)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to list tickets")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Could not load tickets") from None


@router.get("/llm-eval-pack")
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


@router.post("/intake-assist")
async def ticket_intake_assist(
    payload: IntakeAssistRequest,
    _current_user: User = Depends(get_current_user),
) -> IntakeAssistResponse:
    """Rule-based mock intake assistant — no external LLM."""
    return build_intake_assist_draft(payload.messages)


@router.post("", status_code=201)
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
    assigned_team_id = routing.assigned_team_id
    assigned_user_id = routing.assigned_user_id
    if assigned_team_id is None and payload.intake_answers.get("kp2_form_id", "").strip():
        sf_desk_id = await get_sf_service_desk_team_id(db)
        if sf_desk_id is not None:
            assigned_team_id = sf_desk_id
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
    resolved_source = resolve_ticket_source_on_create(
        is_staff_user=is_staff(current_user),
        requested=payload.source,
    )
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number=await generate_ticket_number(db, payload.ticket_type),
        ticket_type=payload.ticket_type,
        title=payload.title,
        description=payload.description,
        status="new",
        priority=routing.priority,
        reporter_user_id=current_user.id,
        organization_id=get_user_organization_id(current_user),
        assigned_team_id=assigned_team_id,
        assigned_user_id=assigned_user_id,
        category_id=payload.category_id,
        subcategory_id=payload.subcategory_id,
        source=resolved_source,
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
    await apply_sla_to_ticket(db, ticket, priority=routing.priority, start_at=now)
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
    try:
        await sync_ticket_stakeholders_on_create(
            db,
            ticket_id=ticket.id,
            reporter_user_id=current_user.id,
            affected_user_ids=payload.affected_user_ids,
            interested_user_ids=payload.interested_user_ids,
            now=now,
        )
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=current_user.id,
            event_type="ticket.created",
            payload={"ticket_number": ticket.ticket_number, "source": resolved_source},
            created_at=now,
        )
    )
    await db.commit()
    await db.refresh(ticket)
    return await ticket_to_read(db, ticket)


@router.get("/{ticket_id}")
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
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)

    # Snapshot scalars before optional reads — rollback/savepoint must not lazy-load ORM state.
    reporter_user_id = ticket.reporter_user_id
    organization_id = ticket.organization_id

    comments_result = await db.execute(
        select(TicketComment)
        .where(
            TicketComment.ticket_id == ticket_id,
            TicketComment.deleted_at.is_(None),
        )
        .order_by(TicketComment.created_at.asc())
    )
    hide_internal = current_user.role == ROLE_SUBMITTER
    comments = await _comments_to_read(
        db,
        list(comments_result.scalars().all()),
        hide_internal=hide_internal,
    )
    comment_ids = [c.id for c in comments]
    reaction_map = await optional_db_read(
        db,
        lambda: load_reaction_summaries(
            db,
            comment_ids,
            current_user_id=current_user.id,
        ),
        default={},
        log_message=f"Could not load comment reactions for ticket {ticket_id}",
    )
    comments = apply_reaction_summaries(comments, reaction_map)

    team_name, user_name = await optional_db_read(
        db,
        lambda: _assignment_names(db, ticket),
        default=(None, None),
        log_message=f"Could not load assignment names for ticket {ticket_id}",
    )

    attachments = await list_ticket_attachments_for_detail(
        db,
        ticket_id,
        current_user,
        reporter_user_id=reporter_user_id,
    )
    ticket_emails_rows = await optional_db_read(
        db,
        lambda: list_ticket_emails(db, ticket_id=ticket_id),
        default=[],
        log_message=f"Could not load ticket emails for ticket {ticket_id}",
    )
    ticket_emails = [
        {
            "id": row.id,
            "direction": row.direction,
            "subject": row.subject,
            "from_email": row.from_email,
            "to_email": row.to_email,
            "body_text": row.body_text,
            "received_at": row.received_at,
        }
        for row in ticket_emails_rows
    ]

    integration_email = None
    if organization_id:
        integration = await optional_db_read(
            db,
            lambda: get_gmail_integration(db, organization_id=organization_id),
            default=None,
            log_message=f"Could not load Gmail integration for ticket {ticket_id}",
        )
        integration_email = integration.connected_email if integration else None
    activity = await build_ticket_activity(db, ticket, current_user)
    stakeholders = await get_ticket_stakeholders_grouped(db, ticket_id)
    reporter_display_name = await resolve_reporter_display_name(db, reporter_user_id)
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
            "ticket_emails": ticket_emails,
            "linked_gmail_email": integration_email,
            "timestamps": ticket_timestamps_read(ticket),
            "activity": activity,
            "stakeholders": stakeholders,
            "reporter_user_id": reporter_user_id,
            "reporter_display_name": reporter_display_name,
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
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)
    if not is_staff(current_user) and current_user.id != ticket.reporter_user_id:
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS)
    now = datetime.now(UTC)
    read = await save_ticket_upload(
        db,
        ticket_id=ticket_id,
        ticket_number=ticket.ticket_number,
        user=current_user,
        upload=file,
    )
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
):
    if not is_staff(current_user):
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS)
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)

    attachment = await db.get(Attachment, attachment_id)
    if attachment is None or attachment.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Attachment not found")

    return await build_attachment_download_response(attachment)


@router.delete(
    "/{ticket_id}/attachments/{attachment_id}",
    status_code=204,
)
async def remove_ticket_attachment(
    ticket_id: uuid.UUID,
    attachment_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> None:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)
    if not is_staff(current_user) and current_user.id != ticket.reporter_user_id:
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS)
    now = datetime.now(UTC)
    removed = await delete_ticket_attachment(
        db,
        ticket_id=ticket_id,
        attachment_id=attachment_id,
        user=current_user,
    )
    touch_ticket_updated(ticket, now)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket_id,
            actor_user_id=current_user.id,
            event_type="ticket.attachment.deleted",
            payload={
                "attachment_id": str(attachment_id),
                "filename": removed.filename,
            },
            created_at=now,
        )
    )
    await db.commit()


@router.patch("/{ticket_id}")
async def update_ticket_status(
    ticket_id: uuid.UUID,
    payload: TicketStatusUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)

    previous_status = ticket.status
    now = datetime.now(UTC)
    sla_settings = await get_sla_runtime_settings(db)
    ticket.status = payload.status
    apply_status_milestone_timestamps(ticket, payload.status, now=now)
    sync_sla_pause_on_status_change(
        ticket,
        previous_status=previous_status,
        new_status=payload.status,
        settings=sla_settings,
        now=now,
    )

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
    await notify_reporter_of_ticket_update(
        db,
        ticket=ticket,
        actor=current_user,
        notification=build_status_notification(
            previous_status=previous_status,
            new_status=payload.status,
        ),
    )
    return await ticket_to_read(db, ticket)


@router.patch("/{ticket_id}/metadata")
async def update_ticket_metadata(
    ticket_id: uuid.UUID,
    payload: TicketMetadataUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> TicketDetailRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)

    updates = payload.model_dump(exclude_unset=True)
    await _apply_ticket_metadata_updates(db, ticket, updates, current_user)

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


@router.patch("/{ticket_id}/priority")
async def update_ticket_priority(
    ticket_id: uuid.UUID,
    payload: TicketPriorityUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketDetailRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
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
        force=True,
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
    await notify_reporter_of_ticket_update(
        db,
        ticket=ticket,
        actor=current_user,
        notification=build_priority_notification(
            previous_priority=previous_priority,
            new_priority=payload.priority,
            reason=reason,
        ),
    )
    return await get_ticket(ticket_id, db, current_user)


@router.patch("/{ticket_id}/ticket-type")
async def update_ticket_type(
    ticket_id: uuid.UUID,
    payload: TicketTypeUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketDetailRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)

    previous_type = ticket.ticket_type
    if payload.ticket_type == previous_type:
        raise HTTPException(
            status_code=400,
            detail="Sagstype er uændret; angiv en ny type for at gemme.",
        )

    reason = payload.reason.strip()
    if len(reason) < 10:
        raise HTTPException(
            status_code=400,
            detail="Begrundelse skal være mindst 10 tegn.",
        )

    now = datetime.now(UTC)
    ticket.ticket_type = payload.ticket_type
    await apply_sla_to_ticket(db, ticket, start_at=ticket.created_at, force=True)
    touch_ticket_updated(ticket, now)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=current_user.id,
            event_type="ticket.type_changed",
            payload={
                "ticket_type": payload.ticket_type,
                "previous_ticket_type": previous_type,
                "reason": reason,
            },
            created_at=now,
        )
    )
    await db.commit()
    return await get_ticket(ticket_id, db, current_user)


@router.post("/{ticket_id}/slack-push")
async def push_ticket_to_slack(
    ticket_id: uuid.UUID,
    payload: SlackPushRequest,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> SlackPushResponse:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)

    org_id = get_user_organization_id(current_user)
    integration = (
        await get_slack_integration(db, organization_id=org_id) if org_id is not None else None
    )

    channel_name = payload.channel_id
    mock_push = False
    message_ts: str | None = None

    if integration is not None and integration.slack_bot_token:
        frontend_origin = (
            settings.cors_origins[0] if settings.cors_origins else settings.frontend_url
        )
        ticket_url = f"{frontend_origin.rstrip('/')}/tickets/{ticket.id}"
        message_text = (
            f":ticket: *{ticket.ticket_number}* - {ticket.title}\n"
            f"Status: `{ticket.status}`\n"
            f"Prioritet: `{ticket.priority}`\n"
            f"<{ticket_url}|Aabn sag i STARdesk>"
        )
        try:
            result = await post_ticket_message(
                bot_token=integration.slack_bot_token,
                channel_id=payload.channel_id,
                text=message_text,
            )
        except SlackApiError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        channel_name = result.channel_id
        message_ts = result.ts
    else:
        if not settings.slack_mock:
            raise HTTPException(status_code=400, detail="Slack er ikke forbundet.")
        channel = get_mock_channel(payload.channel_id)
        if channel is None:
            raise HTTPException(status_code=400, detail="Ukendt Slack-kanal")
        channel_name = channel["name"]
        mock_push = True

    now = datetime.now(UTC)
    touch_ticket_updated(ticket, now)
    db.add(
        TicketEvent(
            id=uuid.uuid4(),
            ticket_id=ticket.id,
            actor_user_id=current_user.id,
            event_type="ticket.slack_pushed",
            payload={
                "channel_id": payload.channel_id,
                "channel_name": channel_name,
                "mock": mock_push,
                "message_ts": message_ts,
            },
            created_at=now,
        )
    )
    await db.commit()
    return SlackPushResponse(
        channel_id=payload.channel_id,
        channel_name=channel_name,
        mock=mock_push,
        message_ts=message_ts,
    )


@router.patch("/{ticket_id}/parent")
async def update_ticket_parent(
    ticket_id: uuid.UUID,
    payload: TicketParentUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketDetailRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
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


@router.post("/{ticket_id}/related-majors", status_code=201)
async def link_related_major_ticket(
    ticket_id: uuid.UUID,
    payload: TicketRelatedMajorCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketDetailRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)
    if not ticket.is_major or ticket.parent_ticket_id is not None:
        raise HTTPException(
            status_code=400, detail="Only store sager can link to other store sager"
        )
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
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
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


@router.patch("/{ticket_id}/assignment")
async def assign_ticket(
    ticket_id: uuid.UUID,
    payload: TicketAssignmentUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketDetailRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)

    updates = payload.model_dump(exclude_unset=True)
    team_id, user_id = await resolve_ticket_assignment(
        db,
        current_team_id=ticket.assigned_team_id,
        current_user_id=ticket.assigned_user_id,
        updates=updates,
    )

    await _validate_assignment_targets(db, current_user, team_id, user_id)

    previous = {
        "assigned_team_id": str(ticket.assigned_team_id) if ticket.assigned_team_id else None,
        "assigned_user_id": str(ticket.assigned_user_id) if ticket.assigned_user_id else None,
    }
    previous_team_id = ticket.assigned_team_id
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
    await maybe_start_sla_on_assignment(
        db,
        ticket,
        previous_team_id=previous_team_id,
        now=now,
    )

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
    assignment_changed = previous != {
        "assigned_team_id": str(team_id) if team_id else None,
        "assigned_user_id": str(user_id) if user_id else None,
    }
    await db.commit()
    await db.refresh(ticket)
    if assignment_changed:
        await notify_reporter_of_ticket_update(
            db,
            ticket=ticket,
            actor=current_user,
            notification=build_assignment_notification(),
        )
    return await get_ticket(ticket_id, db, current_user)


@router.get("/{ticket_id}/stakeholders")
async def list_ticket_stakeholders(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> TicketStakeholdersGroupedRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)
    return await get_ticket_stakeholders_grouped(db, ticket_id)


@router.post("/{ticket_id}/stakeholders", status_code=201)
async def add_ticket_stakeholder(
    ticket_id: uuid.UUID,
    payload: TicketStakeholderCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketStakeholderRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)
    try:
        await validate_stakeholder_user_ids(db, [payload.user_id])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    now = datetime.now(UTC)
    row = await upsert_stakeholder(
        db,
        ticket_id=ticket_id,
        user_id=payload.user_id,
        role=payload.role,
        now=now,
    )
    touch_ticket_updated(ticket, now)
    await db.commit()
    await db.refresh(row)
    return await stakeholder_to_read(db, row)


@router.patch("/{ticket_id}/stakeholders/{stakeholder_id}")
async def update_ticket_stakeholder(
    ticket_id: uuid.UUID,
    stakeholder_id: uuid.UUID,
    payload: TicketStakeholderUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketStakeholderRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)
    row = await db.get(TicketStakeholder, stakeholder_id)
    if (
        row is None
        or row.deleted_at is not None
        or row.ticket_id != ticket_id
        or row.role not in ("affected", "interested")
    ):
        raise HTTPException(status_code=404, detail="Stakeholder not found")
    now = datetime.now(UTC)
    if row.role != payload.role and row.user_id is not None:
        soft_delete_stakeholder(db, row, now=now)
        row = await upsert_stakeholder(
            db,
            ticket_id=ticket_id,
            user_id=row.user_id,
            role=payload.role,
            now=now,
        )
    touch_ticket_updated(ticket, now)
    await db.commit()
    await db.refresh(row)
    return await stakeholder_to_read(db, row)


@router.delete("/{ticket_id}/stakeholders/{stakeholder_id}", status_code=204)
async def remove_ticket_stakeholder(
    ticket_id: uuid.UUID,
    stakeholder_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> None:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)
    row = await db.get(TicketStakeholder, stakeholder_id)
    if (
        row is None
        or row.deleted_at is not None
        or row.ticket_id != ticket_id
        or row.role not in ("affected", "interested")
    ):
        raise HTTPException(status_code=404, detail="Stakeholder not found")
    now = datetime.now(UTC)
    soft_delete_stakeholder(db, row, now=now)
    touch_ticket_updated(ticket, now)
    await db.commit()


@router.get("/{ticket_id}/llm-context")
async def get_ticket_llm_context(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketLlmContextRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)
    return await build_ticket_llm_context(db, ticket)


@router.patch("/{ticket_id}/intelligence")
async def update_ticket_intelligence(
    ticket_id: uuid.UUID,
    payload: TicketIntelligenceUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketIntelligenceRead:
    """Persist LLM or manual triage metadata (e.g. after external evaluation)."""
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)
    updates = payload.model_dump(exclude_unset=True)
    if "semantic_topics" in updates and updates["semantic_topics"] is not None:
        ticket.semantic_topics = [
            t.strip().lower() for t in updates["semantic_topics"] if t.strip()
        ]
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


@router.post("/{ticket_id}/comments", status_code=201)
async def create_comment(
    ticket_id: uuid.UUID,
    payload: CommentCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> CommentRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
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
    if payload.broadcast_to_children:
        if not is_store_sag(ticket):
            raise HTTPException(
                status_code=400,
                detail="Broadcast is only allowed on store sager",
            )
        if await count_children(db, ticket.id) == 0:
            raise HTTPException(
                status_code=400,
                detail="No child tickets to broadcast to",
            )
        await broadcast_comment_to_children(
            db,
            parent=ticket,
            author=current_user,
            body=payload.body,
            is_internal=is_internal,
            is_staff_author=is_staff(current_user),
            now=now,
        )
    await process_comment_mentions(
        db,
        ticket_id=ticket_id,
        comment_id=comment.id,
        body=payload.body,
        author_user_id=current_user.id,
        now=now,
    )
    await db.commit()
    await db.refresh(comment)
    if not is_internal:
        actor_name = current_user.display_name or "STARdesk"
        await notify_reporter_of_ticket_update(
            db,
            ticket=ticket,
            actor=current_user,
            notification=build_comment_notification(actor_name=actor_name),
        )
    read = await _comment_to_read(db, comment, hide_internal=False)
    assert read is not None
    summaries = await load_reaction_summaries(db, [read.id], current_user_id=current_user.id)
    enriched = apply_reaction_summaries([read], summaries)
    return enriched[0]


@router.post("/{ticket_id}/email-reply")
async def reply_ticket_email(
    ticket_id: uuid.UUID,
    payload: TicketEmailReplyRequest,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketDetailRead:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)
    try:
        await send_ticket_email_reply(
            db,
            ticket=ticket,
            actor=current_user,
            body=payload.body,
            to_email_override=payload.to_email,
        )
    except GmailApiError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await get_ticket(ticket_id, db, current_user)


@router.put("/{ticket_id}/comments/{comment_id}/reactions")
async def upsert_comment_reaction(
    ticket_id: uuid.UUID,
    comment_id: uuid.UUID,
    payload: CommentReactionUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> CommentReactionSummary:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    await _ensure_ticket_access(db, ticket, current_user)

    comment = await db.get(TicketComment, comment_id)
    if comment is None or comment.deleted_at is not None or comment.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if current_user.role == ROLE_SUBMITTER and comment.is_internal:
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS)

    summary = await set_comment_reaction(
        db,
        comment_id=comment_id,
        user_id=current_user.id,
        sentiment=payload.sentiment,
    )
    await db.commit()
    return summary
