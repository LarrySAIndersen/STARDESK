from unittest.mock import MagicMock

import pytest

from star_itsm_api.core.security import ROLE_AGENT, ROLE_SUBMITTER
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
