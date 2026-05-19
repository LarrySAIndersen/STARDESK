from types import SimpleNamespace
from unittest.mock import MagicMock

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


def _article(*, status: str, visibility: str) -> MagicMock:
    ticket = MagicMock()
    ticket.is_knowledge_article = True
    ticket.knowledge_status = status
    ticket.knowledge_visibility = visibility
    return ticket


def test_staff_can_read_draft_internal() -> None:
    user = SimpleNamespace(role=ROLE_AGENT)
    article = _article(status=KNOWLEDGE_STATUS_DRAFT, visibility=KNOWLEDGE_VISIBILITY_INTERNAL)
    assert can_read_knowledge_article(user, article) is True


def test_end_user_cannot_read_draft() -> None:
    user = SimpleNamespace(role=ROLE_SUBMITTER)
    article = _article(status=KNOWLEDGE_STATUS_DRAFT, visibility=KNOWLEDGE_VISIBILITY_EXTERNAL)
    assert can_read_knowledge_article(user, article) is False


def test_end_user_can_read_published_external() -> None:
    user = SimpleNamespace(role=ROLE_SUBMITTER)
    article = _article(status=KNOWLEDGE_STATUS_PUBLISHED, visibility=KNOWLEDGE_VISIBILITY_EXTERNAL)
    assert can_read_knowledge_article(user, article) is True


def test_end_user_cannot_read_published_internal() -> None:
    user = SimpleNamespace(role=ROLE_SUBMITTER)
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
