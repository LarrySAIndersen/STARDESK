import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select

from star_itsm_api.core.security import ROLE_ADMIN, ROLE_AGENT, ROLE_SUBMITTER
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services import knowledge_articles as ka_service
from star_itsm_api.services.knowledge_articles import (
    KNOWLEDGE_STATUS_DRAFT,
    KNOWLEDGE_STATUS_PUBLISHED,
    KNOWLEDGE_VISIBILITY_EXTERNAL,
    KNOWLEDGE_VISIBILITY_INTERNAL,
    can_read_knowledge_article,
)
from star_itsm_api.services.knowledge_content import (
    build_knowledge_description,
    get_knowledge_sections,
    set_knowledge_sections,
)
from tests.support.users import make_test_user


def _article(*, status: str, visibility: str) -> MagicMock:
    ticket = MagicMock()
    ticket.is_knowledge_article = True
    ticket.knowledge_status = status
    ticket.knowledge_visibility = visibility
    return ticket


def test_staff_can_read_draft_internal() -> None:
    user = make_test_user(role=ROLE_AGENT)
    article = _article(status=KNOWLEDGE_STATUS_DRAFT, visibility=KNOWLEDGE_VISIBILITY_INTERNAL)
    assert can_read_knowledge_article(user, article) is True


def test_end_user_cannot_read_draft() -> None:
    user = make_test_user(role=ROLE_SUBMITTER)
    article = _article(status=KNOWLEDGE_STATUS_DRAFT, visibility=KNOWLEDGE_VISIBILITY_EXTERNAL)
    assert can_read_knowledge_article(user, article) is False


def test_end_user_can_read_published_external() -> None:
    user = make_test_user(role=ROLE_SUBMITTER)
    article = _article(status=KNOWLEDGE_STATUS_PUBLISHED, visibility=KNOWLEDGE_VISIBILITY_EXTERNAL)
    assert can_read_knowledge_article(user, article) is True


def test_end_user_cannot_read_published_internal() -> None:
    user = make_test_user(role=ROLE_SUBMITTER)
    article = _article(status=KNOWLEDGE_STATUS_PUBLISHED, visibility=KNOWLEDGE_VISIBILITY_INTERNAL)
    assert can_read_knowledge_article(user, article) is False


def test_knowledge_sections_roundtrip() -> None:
    ticket = MagicMock()
    ticket.routing_metadata = {}
    ticket.description = ""
    set_knowledge_sections(
        ticket,
        {
            "summary": "Kort resumé her.",
            "symptoms": "- Symptom A",
            "solution": "Gør sådan.",
            "related_topics": "Anden artikel",
        },
    )
    sections = get_knowledge_sections(ticket)
    assert sections["summary"] == "Kort resumé her."
    assert "## Resumé" in ticket.description
    assert "## Løsning" in build_knowledge_description(sections)


async def test_list_knowledge_articles_without_database_returns_503(
    client,
) -> None:
    response = await client.get("/api/v1/knowledge-articles?portal=true")
    assert response.status_code == 503


def test_get_knowledge_sections_empty_or_invalid_meta() -> None:
    ticket = MagicMock()
    ticket.routing_metadata = None
    sections = get_knowledge_sections(ticket)
    assert sections == {
        "summary": "",
        "symptoms": "",
        "solution": "",
        "related_topics": "",
    }

    # routing_metadata is a dict but "knowledge" key is missing or not a dict
    ticket.routing_metadata = {"knowledge": "not-a-dict"}
    sections = get_knowledge_sections(ticket)
    assert sections == {
        "summary": "",
        "symptoms": "",
        "solution": "",
        "related_topics": "",
    }


def test_build_knowledge_description_empty_sections() -> None:
    # Some sections are empty
    sections = {
        "summary": "   ",
        "symptoms": "Symptom",
        "solution": "",
        "related_topics": None,
    }
    desc = build_knowledge_description(sections)
    assert "Resumé" not in desc
    assert "Symptomer" in desc
    assert "Løsning" not in desc


def test_sections_have_min_content() -> None:
    from star_itsm_api.services.knowledge_content import sections_have_min_content
    sections = {
        "summary": "Short",
        "symptoms": "",
        "solution": "",
        "related_topics": "",
    }
    assert sections_have_min_content(sections, min_chars=10) is False
    assert sections_have_min_content(sections, min_chars=5) is True


# --- predicate helpers ----------------------------------------------------


def test_is_portal_knowledge_reader() -> None:
    submitter = make_test_user(role=ROLE_SUBMITTER)
    agent = make_test_user(role=ROLE_AGENT)
    assert ka_service.is_portal_knowledge_reader(submitter) is True
    assert ka_service.is_portal_knowledge_reader(agent) is False


def test_can_read_knowledge_article_non_article_returns_false() -> None:
    user = make_test_user(role=ROLE_AGENT)
    ticket = MagicMock()
    ticket.is_knowledge_article = False
    assert can_read_knowledge_article(user, ticket) is False


# --- statement builders ---------------------------------------------------


def test_apply_knowledge_only_returns_select() -> None:
    stmt = ka_service.apply_knowledge_only(select(Ticket))
    assert "is_knowledge_article" in str(stmt).lower()


def test_exclude_knowledge_articles_returns_select() -> None:
    stmt = ka_service.exclude_knowledge_articles(select(Ticket))
    assert "is_knowledge_article" in str(stmt).lower()


def test_apply_portal_published_filter_returns_select() -> None:
    stmt = ka_service.apply_portal_published_filter(select(Ticket))
    rendered = str(stmt).lower()
    assert "knowledge_status" in rendered
    assert "knowledge_visibility" in rendered


def test_apply_staff_knowledge_filters_none() -> None:
    stmt = ka_service.apply_staff_knowledge_filters(
        select(Ticket), status=None, visibility=None
    )
    assert "is_knowledge_article" in str(stmt).lower()


def test_apply_staff_knowledge_filters_with_values() -> None:
    stmt = ka_service.apply_staff_knowledge_filters(
        select(Ticket),
        status=KNOWLEDGE_STATUS_PUBLISHED,
        visibility=KNOWLEDGE_VISIBILITY_EXTERNAL,
    )
    rendered = str(stmt).lower()
    assert "knowledge_status" in rendered
    assert "knowledge_visibility" in rendered


# --- list / get -----------------------------------------------------------


@pytest.mark.asyncio
async def test_list_knowledge_articles_portal() -> None:
    ticket = MagicMock()
    execute_result = MagicMock()
    execute_result.scalars.return_value.all.return_value = [ticket]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    rows = await ka_service.list_knowledge_articles(
        db, portal=True, status=None, visibility=None, q=None, limit=50
    )
    assert rows == [ticket]


@pytest.mark.asyncio
async def test_list_knowledge_articles_staff_with_query() -> None:
    ticket = MagicMock()
    execute_result = MagicMock()
    execute_result.scalars.return_value.all.return_value = [ticket]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    rows = await ka_service.list_knowledge_articles(
        db,
        portal=False,
        status=KNOWLEDGE_STATUS_DRAFT,
        visibility=KNOWLEDGE_VISIBILITY_INTERNAL,
        q="printer",
        limit=10,
    )
    assert rows == [ticket]


@pytest.mark.asyncio
async def test_get_knowledge_article_found_and_missing() -> None:
    article = MagicMock()
    found_result = MagicMock()
    found_result.scalar_one_or_none.return_value = article
    missing_result = MagicMock()
    missing_result.scalar_one_or_none.return_value = None
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[found_result, missing_result])

    assert await ka_service.get_knowledge_article(db, uuid.uuid4()) is article
    assert await ka_service.get_knowledge_article(db, uuid.uuid4()) is None


# --- create / promote -----------------------------------------------------


@pytest.mark.asyncio
async def test_create_knowledge_article() -> None:
    org_id = uuid.uuid4()
    user = make_test_user(role=ROLE_ADMIN, organization_id=org_id)
    db = AsyncMock()
    db.add = MagicMock()

    with patch.object(
        ka_service,
        "generate_ticket_number",
        AsyncMock(return_value="KA-2026-00001"),
    ):
        ticket = await ka_service.create_knowledge_article(
            db,
            user=user,
            title="Sådan nulstiller du adgangskode",
            description="Beskrivelse med æøå",
            tags=["adgang", "kode"],
            knowledge_status=KNOWLEDGE_STATUS_PUBLISHED,
            knowledge_visibility=KNOWLEDGE_VISIBILITY_EXTERNAL,
        )

    db.add.assert_called_once_with(ticket)
    assert ticket.ticket_number == "KA-2026-00001"
    assert ticket.is_knowledge_article is True
    assert ticket.status == "closed"
    assert ticket.knowledge_status == KNOWLEDGE_STATUS_PUBLISHED
    assert ticket.knowledge_visibility == KNOWLEDGE_VISIBILITY_EXTERNAL
    assert ticket.organization_id == org_id
    assert ticket.tags == ["adgang", "kode"]


def test_promote_ticket_to_knowledge_open_ticket_gets_closed() -> None:
    ticket = SimpleNamespace(
        is_knowledge_article=False,
        knowledge_status=None,
        knowledge_visibility=None,
        updated_at=None,
        status="in_progress",
        closed_at=None,
    )
    promoted = ka_service.promote_ticket_to_knowledge(
        ticket,
        knowledge_status=KNOWLEDGE_STATUS_DRAFT,
        knowledge_visibility=KNOWLEDGE_VISIBILITY_INTERNAL,
    )
    assert promoted.is_knowledge_article is True
    assert promoted.status == "closed"
    assert promoted.closed_at is not None
    assert promoted.knowledge_status == KNOWLEDGE_STATUS_DRAFT


def test_promote_ticket_to_knowledge_resolved_keeps_status() -> None:
    existing_closed = datetime(2026, 1, 1, tzinfo=UTC)
    ticket = SimpleNamespace(
        is_knowledge_article=False,
        knowledge_status=None,
        knowledge_visibility=None,
        updated_at=None,
        status="resolved",
        closed_at=existing_closed,
    )
    promoted = ka_service.promote_ticket_to_knowledge(
        ticket,
        knowledge_status=KNOWLEDGE_STATUS_PUBLISHED,
        knowledge_visibility=KNOWLEDGE_VISIBILITY_EXTERNAL,
    )
    # status not in (resolved, closed) is False -> status untouched.
    assert promoted.status == "resolved"
    assert promoted.closed_at == existing_closed
