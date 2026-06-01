"""API router tests for /api/v1/tickets — list filters, mutations, and integrations."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from star_itsm_api.core.config import settings
from star_itsm_api.core.security import ROLE_AGENT, ROLE_SUBMITTER, get_current_user
from star_itsm_api.main import app
from star_itsm_api.schemas.comment import CommentRead, CommentReactionSummary
from star_itsm_api.schemas.ticket import TicketDetailRead, TicketRead
from star_itsm_api.schemas.ticket_activity import TicketTimestampsRead
from star_itsm_api.schemas.ticket_intelligence import (
    TicketIntelligenceRead,
    TicketLlmContextRead,
    TicketLlmOperationalRead,
    TicketSemanticBundleRead,
)

_FAKE_ADMIN_ID = uuid.UUID("00000000-0000-0000-0000-000000000030")


def _ticket_read(ticket_id: uuid.UUID | None = None) -> TicketRead:
    now = datetime.now(UTC)
    tid = ticket_id or uuid.uuid4()
    return TicketRead(
        id=tid,
        ticket_number="INC-2026-00042",
        title="Printer fejl",
        status="new",
        priority="medium",
        ticket_type="incident",
        reporter_user_id=_FAKE_ADMIN_ID,
        created_at=now,
        source="portal",
    )


def _ticket_detail(ticket_id: uuid.UUID | None = None) -> TicketDetailRead:
    read = _ticket_read(ticket_id)
    now = read.created_at
    return TicketDetailRead(
        **read.model_dump(),
        description="Printeren svarer ikke.",
        category_id=None,
        subcategory_id=None,
        assigned_user_id=None,
        escalation_level=0,
        gdpr_consent=False,
        timestamps=TicketTimestampsRead(created_at=now),
    )


def _ticket_row(ticket_id: uuid.UUID | None = None, **kwargs: object) -> SimpleNamespace:
    now = datetime.now(UTC)
    tid = ticket_id or uuid.uuid4()
    defaults: dict[str, object] = {
        "id": tid,
        "ticket_number": "INC-2026-00042",
        "title": "Printer fejl",
        "description": "Printeren svarer ikke.",
        "status": "new",
        "priority": "medium",
        "ticket_type": "incident",
        "reporter_user_id": _FAKE_ADMIN_ID,
        "organization_id": None,
        "assigned_team_id": None,
        "assigned_user_id": None,
        "category_id": None,
        "subcategory_id": None,
        "source": "portal",
        "is_major": False,
        "is_shared": False,
        "is_security_ticket": False,
        "parent_ticket_id": None,
        "deleted_at": None,
        "created_at": now,
        "updated_at": now,
        "assignment_reason": None,
        "fault_displayed": False,
        "semantic_topics": None,
        "ease_score": None,
        "complexity_score": None,
        "llm_summary": None,
        "handling_hints": None,
        "intelligence_source": None,
        "intelligence_updated_at": None,
        "first_response_at": None,
        "escalation_level": 0,
        "response_due_at": None,
        "resolution_due_at": None,
        "resolved_at": None,
        "in_progress_at": None,
        "on_hold_at": None,
        "assigned_at": None,
        "closed_at": None,
        "cancelled_at": None,
        "last_escalation_at": None,
        "gdpr_consent_at": None,
        "gdpr_consent": False,
        "subject_cpr": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


async def _fake_agent() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="agent@example.dk",
        display_name="Agent",
        role=ROLE_AGENT,
        is_active=True,
        password_hash=None,
        deleted_at=None,
        organization_id=None,
    )


async def _fake_submitter() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="user@example.dk",
        display_name="Bruger",
        role=ROLE_SUBMITTER,
        is_active=True,
        password_hash=None,
        deleted_at=None,
        organization_id=None,
    )


@pytest.mark.asyncio
async def test_list_tickets_invalid_stakeholder_filter(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/tickets?stakeholder=other")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_tickets_invalid_scope(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/tickets?scope=not-a-scope")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_tickets_invalid_sla(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/tickets?sla=broken")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_tickets_invalid_sort(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/tickets?sort=not-valid")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_tickets_board_forbidden_for_submitter(api_client: AsyncClient) -> None:
    app.dependency_overrides[get_current_user] = _fake_submitter
    try:
        response = await api_client.get("/api/v1/tickets?board=true")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_tickets_scope_forbidden_for_submitter(api_client: AsyncClient) -> None:
    app.dependency_overrides[get_current_user] = _fake_submitter
    try:
        response = await api_client.get("/api/v1/tickets?scope=all")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_tickets_bucket_forbidden_for_submitter(api_client: AsyncClient) -> None:
    app.dependency_overrides[get_current_user] = _fake_submitter
    try:
        response = await api_client.get("/api/v1/tickets?bucket=modtaget")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_tickets_assignee_filter_forbidden_for_agent(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _fake_agent
    try:
        response = await api_client.get(f"/api/v1/tickets?assignee_id={uuid.uuid4()}")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_tickets_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    override_db.execute = AsyncMock(return_value=mock_result)

    with patch(
        "star_itsm_api.routers.tickets.tickets_to_read_list",
        new_callable=AsyncMock,
        return_value=[],
    ):
        response = await api_client.get("/api/v1/tickets?open_only=true&q=printer")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_intake_assist_returns_draft(api_client: AsyncClient) -> None:
    response = await api_client.post(
        "/api/v1/tickets/intake-assist",
        json={"messages": [{"role": "user", "content": "Min printer virker ikke"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"]
    assert body["suggested_priority"] in {"critical", "high", "medium", "low"}


@pytest.mark.asyncio
async def test_get_ticket_not_found(override_db: AsyncMock, api_client: AsyncClient) -> None:
    override_db.get = AsyncMock(return_value=None)
    ticket_id = uuid.uuid4()
    response = await api_client.get(f"/api/v1/tickets/{ticket_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_ticket_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    ticket_id = uuid.uuid4()
    detail = _ticket_detail(ticket_id)

    with patch(
        "star_itsm_api.routers.tickets._get_ticket_detail",
        new_callable=AsyncMock,
        return_value=detail,
    ):
        response = await api_client.get(f"/api/v1/tickets/{ticket_id}")

    assert response.status_code == 200
    assert response.json()["ticket_number"] == "INC-2026-00042"


@pytest.mark.asyncio
async def test_update_status_not_found(override_db: AsyncMock, api_client: AsyncClient) -> None:
    override_db.get = AsyncMock(return_value=None)
    ticket_id = uuid.uuid4()
    response = await api_client.patch(
        f"/api/v1/tickets/{ticket_id}",
        json={"status": "in_progress"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_status_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    ticket_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id, status="new")
    override_db.get = AsyncMock(return_value=ticket)
    read = _ticket_read(ticket_id)

    with (
        patch(
            "star_itsm_api.routers.tickets.user_can_access_ticket",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "star_itsm_api.routers.tickets.get_sla_runtime_settings",
            new_callable=AsyncMock,
            return_value=MagicMock(),
        ),
        patch(
            "star_itsm_api.routers.tickets.notify_reporter_of_ticket_update",
            new_callable=AsyncMock,
        ),
        patch(
            "star_itsm_api.routers.tickets.ticket_to_read",
            new_callable=AsyncMock,
            return_value=read,
        ),
    ):
        response = await api_client.patch(
            f"/api/v1/tickets/{ticket_id}",
            json={"status": "in_progress"},
        )

    assert response.status_code == 200
    assert ticket.status == "in_progress"
    override_db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_update_priority_rejects_unchanged(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    ticket_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id, priority="medium")
    override_db.get = AsyncMock(return_value=ticket)

    with patch(
        "star_itsm_api.routers.tickets.user_can_access_ticket",
        new_callable=AsyncMock,
        return_value=True,
    ):
        response = await api_client.patch(
            f"/api/v1/tickets/{ticket_id}/priority",
            json={"priority": "medium", "reason": "Samme prioritet som før"},
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_priority_rejects_short_reason(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    ticket_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id, priority="medium")
    override_db.get = AsyncMock(return_value=ticket)

    with patch(
        "star_itsm_api.routers.tickets.user_can_access_ticket",
        new_callable=AsyncMock,
        return_value=True,
    ):
        response = await api_client.patch(
            f"/api/v1/tickets/{ticket_id}/priority",
            json={"priority": "high", "reason": "kort"},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_intelligence_persists_scores(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    ticket_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id)
    override_db.get = AsyncMock(return_value=ticket)

    with patch(
        "star_itsm_api.routers.tickets.user_can_access_ticket",
        new_callable=AsyncMock,
        return_value=True,
    ):
        response = await api_client.patch(
            f"/api/v1/tickets/{ticket_id}/intelligence",
            json={
                "ease_score": 4,
                "complexity_score": 2,
                "semantic_topics": ["printer", "netværk"],
                "llm_summary": "Enkel printerfejl.",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["ease_score"] == 4
    assert "printer" in body["semantic_topics"]


@pytest.mark.asyncio
async def test_create_comment_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    ticket_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id)
    admin = SimpleNamespace(
        id=_FAKE_ADMIN_ID,
        display_name="Admin Bruger",
    )
    override_db.get = AsyncMock(side_effect=[ticket, admin])
    override_db.refresh = AsyncMock()

    comment_read = CommentRead(
        id=uuid.uuid4(),
        body="Vi kigger på det.",
        is_internal=False,
        visibility="external",
        visibility_label_da="Ekstern (kundeportal)",
        author_display_name="Admin Bruger",
        created_at=datetime.now(UTC),
    )

    with (
        patch(
            "star_itsm_api.routers.tickets.user_can_access_ticket",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "star_itsm_api.routers.tickets.process_comment_mentions",
            new_callable=AsyncMock,
        ),
        patch(
            "star_itsm_api.routers.tickets.notify_reporter_of_ticket_update",
            new_callable=AsyncMock,
        ),
        patch(
            "star_itsm_api.routers.tickets._comment_to_read",
            new_callable=AsyncMock,
            return_value=comment_read,
        ),
        patch(
            "star_itsm_api.routers.tickets.load_reaction_summaries",
            new_callable=AsyncMock,
            return_value={},
        ),
    ):
        response = await api_client.post(
            f"/api/v1/tickets/{ticket_id}/comments",
            json={"body": "Vi kigger på det."},
        )

    assert response.status_code == 201
    assert response.json()["body"] == "Vi kigger på det."


@pytest.mark.asyncio
async def test_slack_push_mock_channel(
    override_db: AsyncMock,
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ticket_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id)
    override_db.get = AsyncMock(return_value=ticket)
    monkeypatch.setattr(settings, "slack_mock", True)

    with (
        patch(
            "star_itsm_api.routers.tickets.user_can_access_ticket",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "star_itsm_api.routers.tickets.get_slack_integration",
            new_callable=AsyncMock,
            return_value=None,
        ),
    ):
        response = await api_client.post(
            f"/api/v1/tickets/{ticket_id}/slack-push",
            json={"channel_id": "C_MOCK_IT_SUPPORT"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["mock"] is True
    assert body["channel_name"] == "it-support"


@pytest.mark.asyncio
async def test_llm_eval_pack_returns_items(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    override_db.execute = AsyncMock(return_value=mock_result)

    with patch(
        "star_itsm_api.routers.tickets.build_llm_context_batch",
        new_callable=AsyncMock,
        return_value=[],
    ):
        response = await api_client.get("/api/v1/tickets/llm-eval-pack?page=1&page_size=10")

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 0
    assert "evaluation_rubric_da" in body


@pytest.mark.asyncio
async def test_llm_context_not_found(override_db: AsyncMock, api_client: AsyncClient) -> None:
    override_db.get = AsyncMock(return_value=None)
    ticket_id = uuid.uuid4()
    response = await api_client.get(f"/api/v1/tickets/{ticket_id}/llm-context")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_llm_context_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    ticket_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id)
    override_db.get = AsyncMock(return_value=ticket)
    context = TicketLlmContextRead(
        ticket_id=ticket_id,
        ticket_number="INC-2026-00042",
        intelligence=TicketIntelligenceRead(),
        semantic_bundle=TicketSemanticBundleRead(
            title="Printer fejl",
            description="Printeren svarer ikke.",
            combined_text="Printer fejl — Printeren svarer ikke.",
        ),
        operational=TicketLlmOperationalRead(
            status="new",
            priority="medium",
            ticket_type="incident",
            is_major=False,
            escalation_level=0,
            fault_displayed=False,
            age_hours=2.5,
        ),
        prompt_snippet_da="Opsummer sag",
        evaluation_rubric_da=EVALUATION_RUBRIC_DA,
    )

    with (
        patch(
            "star_itsm_api.routers.tickets.user_can_access_ticket",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "star_itsm_api.routers.tickets.build_ticket_llm_context",
            new_callable=AsyncMock,
            return_value=context,
        ),
    ):
        response = await api_client.get(f"/api/v1/tickets/{ticket_id}/llm-context")

    assert response.status_code == 200
    assert response.json()["ticket_number"] == "INC-2026-00042"


@pytest.mark.asyncio
async def test_comment_reaction_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    ticket_id = uuid.uuid4()
    comment_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id)
    comment = SimpleNamespace(
        id=comment_id,
        ticket_id=ticket_id,
        is_internal=False,
        deleted_at=None,
    )
    override_db.get = AsyncMock(side_effect=[ticket, comment])
    summary = CommentReactionSummary(
        positive_count=1,
        negative_count=0,
        current_user_sentiment="positive",
    )

    with (
        patch(
            "star_itsm_api.routers.tickets.user_can_access_ticket",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "star_itsm_api.routers.tickets.set_comment_reaction",
            new_callable=AsyncMock,
            return_value=summary,
        ),
    ):
        response = await api_client.put(
            f"/api/v1/tickets/{ticket_id}/comments/{comment_id}/reactions",
            json={"sentiment": "positive"},
        )

    assert response.status_code == 200
    assert response.json()["positive_count"] == 1


@pytest.mark.asyncio
async def test_link_related_major_rejects_non_store_sag(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    ticket_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id, is_major=False)
    override_db.get = AsyncMock(return_value=ticket)

    with patch(
        "star_itsm_api.routers.tickets.user_can_access_ticket",
        new_callable=AsyncMock,
        return_value=True,
    ):
        response = await api_client.post(
            f"/api/v1/tickets/{ticket_id}/related-majors",
            json={"related_ticket_id": str(uuid.uuid4())},
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_assign_ticket_not_found(override_db: AsyncMock, api_client: AsyncClient) -> None:
    override_db.get = AsyncMock(return_value=None)
    ticket_id = uuid.uuid4()
    response = await api_client.patch(
        f"/api/v1/tickets/{ticket_id}/assignment",
        json={"assigned_team_id": str(uuid.uuid4())},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_assign_ticket_invalid_team(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    ticket_id = uuid.uuid4()
    team_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id)
    override_db.get = AsyncMock(side_effect=[ticket, None])

    with (
        patch(
            "star_itsm_api.routers.tickets.user_can_access_ticket",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "star_itsm_api.routers.tickets.resolve_ticket_assignment",
            new_callable=AsyncMock,
            return_value=(team_id, None),
        ),
    ):
        response = await api_client.patch(
            f"/api/v1/tickets/{ticket_id}/assignment",
            json={"assigned_team_id": str(team_id)},
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_create_ticket_rejects_major_with_parent(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    with (
        patch(
            "star_itsm_api.routers.tickets.apply_routing",
            new_callable=AsyncMock,
            return_value=SimpleNamespace(
                assigned_team_id=None,
                assigned_user_id=None,
                priority="medium",
            ),
        ),
        patch(
            "star_itsm_api.routers.tickets.validate_sub_cause_ids",
            new_callable=AsyncMock,
        ),
    ):
        response = await api_client.post(
            "/api/v1/tickets",
            json={
                "title": "Store hændelse",
                "description": "Beskrivelse af store hændelse her.",
                "is_major": True,
                "parent_ticket_id": str(uuid.uuid4()),
            },
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_ticket_type_rejects_unchanged(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    ticket_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id, ticket_type="incident")
    override_db.get = AsyncMock(return_value=ticket)

    with patch(
        "star_itsm_api.routers.tickets.user_can_access_ticket",
        new_callable=AsyncMock,
        return_value=True,
    ):
        response = await api_client.patch(
            f"/api/v1/tickets/{ticket_id}/ticket-type",
            json={
                "ticket_type": "incident",
                "reason": "Forsøger at gemme samme type igen",
            },
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_stakeholders_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    from star_itsm_api.schemas.stakeholder import TicketStakeholdersGroupedRead

    ticket_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id)
    override_db.get = AsyncMock(return_value=ticket)
    grouped = TicketStakeholdersGroupedRead(affected=[], interested=[])

    with (
        patch(
            "star_itsm_api.routers.tickets.user_can_access_ticket",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "star_itsm_api.routers.tickets.get_ticket_stakeholders_grouped",
            new_callable=AsyncMock,
            return_value=grouped,
        ),
    ):
        response = await api_client.get(f"/api/v1/tickets/{ticket_id}/stakeholders")

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_email_reply_not_found(override_db: AsyncMock, api_client: AsyncClient) -> None:
    override_db.get = AsyncMock(return_value=None)
    ticket_id = uuid.uuid4()
    response = await api_client.post(
        f"/api/v1/tickets/{ticket_id}/email-reply",
        json={"body": "Hej, vi arbejder på sagen."},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_email_reply_gmail_error(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    from star_itsm_api.services.gmail import GmailApiError

    ticket_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id)
    override_db.get = AsyncMock(return_value=ticket)

    with (
        patch(
            "star_itsm_api.routers.tickets.user_can_access_ticket",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "star_itsm_api.routers.tickets.send_ticket_email_reply",
            new_callable=AsyncMock,
            side_effect=GmailApiError("not connected"),
        ),
    ):
        response = await api_client.post(
            f"/api/v1/tickets/{ticket_id}/email-reply",
            json={"body": "Hej, vi arbejder på sagen."},
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_tickets_major_open_for_staff(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    override_db.execute = AsyncMock(return_value=mock_result)

    with patch(
        "star_itsm_api.routers.tickets.tickets_to_read_list",
        new_callable=AsyncMock,
        return_value=[],
    ):
        response = await api_client.get("/api/v1/tickets?major_open=true")

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_update_metadata_tags_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    ticket_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id, tags=[])
    override_db.get = AsyncMock(return_value=ticket)
    detail = _ticket_detail(ticket_id)

    with (
        patch(
            "star_itsm_api.routers.tickets.user_can_access_ticket",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "star_itsm_api.routers.tickets.get_ticket",
            new_callable=AsyncMock,
            return_value=detail,
        ),
    ):
        response = await api_client.patch(
            f"/api/v1/tickets/{ticket_id}/metadata",
            json={"tags": ["printer", "kontor"]},
        )

    assert response.status_code == 200
    assert ticket.tags == ["printer", "kontor"]


@pytest.mark.asyncio
async def test_get_ticket_runs_detail_pipeline(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    from star_itsm_api.schemas.stakeholder import TicketStakeholdersGroupedRead

    ticket_id = uuid.uuid4()
    ticket = _ticket_row(ticket_id)
    override_db.get = AsyncMock(return_value=ticket)
    empty_result = MagicMock()
    empty_result.scalars.return_value.all.return_value = []
    override_db.execute = AsyncMock(return_value=empty_result)
    detail = _ticket_detail(ticket_id)

    with (
        patch(
            "star_itsm_api.routers.tickets.user_can_access_ticket",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "star_itsm_api.routers.tickets.load_reaction_summaries",
            new_callable=AsyncMock,
            return_value={},
        ),
        patch(
            "star_itsm_api.routers.tickets.list_ticket_attachments_for_detail",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "star_itsm_api.routers.tickets.list_ticket_emails",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "star_itsm_api.routers.tickets.build_ticket_activity",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "star_itsm_api.routers.tickets.get_ticket_stakeholders_grouped",
            new_callable=AsyncMock,
            return_value=TicketStakeholdersGroupedRead(affected=[], interested=[]),
        ),
        patch(
            "star_itsm_api.routers.tickets.resolve_reporter_display_name",
            new_callable=AsyncMock,
            return_value="Anna",
        ),
        patch(
            "star_itsm_api.routers.tickets.ticket_to_detail_read",
            new_callable=AsyncMock,
            return_value=detail,
        ),
    ):
        response = await api_client.get(f"/api/v1/tickets/{ticket_id}")

    assert response.status_code == 200
    assert response.json()["description"] == "Printeren svarer ikke."
