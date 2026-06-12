"""Batch 17 — MCP router tools (help-a-bot backend) coverage."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.routers import mcp as mcp_mod
from tests.conftest import FAKE_ADMIN


class _FakeSessionFactory:
    def __init__(self, session: AsyncMock) -> None:
        self._session = session

    def __call__(self) -> "_FakeSessionFactory":
        return self

    async def __aenter__(self) -> AsyncMock:
        return self._session

    async def __aexit__(self, *args: object) -> None:
        pass


def _fake_ticket(**kwargs: object) -> SimpleNamespace:
    defaults: dict[str, object] = {
        "id": uuid.uuid4(),
        "title": "VPN guide",
        "description": "How to connect to VPN",
        "ticket_number": "INC-2026-00001",
        "tags": ["vpn"],
        "status": "new",
        "priority": "medium",
        "ticket_type": "incident",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
        "reporter_user_id": FAKE_ADMIN.id,
        "llm_summary": "Reset VPN client",
        "semantic_topics": ["network"],
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


@pytest.fixture
def mock_session() -> AsyncMock:
    session = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.add = MagicMock()
    return session


@pytest.fixture
def session_factory(mock_session: AsyncMock) -> _FakeSessionFactory:
    return _FakeSessionFactory(mock_session)


@pytest.mark.asyncio
async def test_search_knowledge_no_database() -> None:
    with patch.object(mcp_mod, "async_session_factory", None):
        result = await mcp_mod.search_knowledge_articles("vpn")
    assert "Database" in result


@pytest.mark.asyncio
async def test_search_knowledge_returns_articles(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    scalars = MagicMock()
    scalars.all.return_value = [_fake_ticket()]
    mock_session.execute = AsyncMock(return_value=MagicMock(scalars=lambda: scalars))
    with patch.object(mcp_mod, "async_session_factory", session_factory):
        result = await mcp_mod.search_knowledge_articles("vpn")
    assert "VPN guide" in result
    assert "INC-2026-00001" in result
    assert "vpn" in result


@pytest.mark.asyncio
async def test_search_knowledge_empty(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    scalars = MagicMock()
    scalars.all.return_value = []
    mock_session.execute = AsyncMock(return_value=MagicMock(scalars=lambda: scalars))
    with patch.object(mcp_mod, "async_session_factory", session_factory):
        result = await mcp_mod.search_knowledge_articles("ost")
    assert "Ingen vidensartikler" in result


@pytest.mark.asyncio
async def test_get_ticket_categories_no_database() -> None:
    with patch.object(mcp_mod, "async_session_factory", None):
        result = await mcp_mod.get_ticket_categories()
    assert "Database" in result


@pytest.mark.asyncio
async def test_get_ticket_categories_lists_hierarchy(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    cat_id = uuid.uuid4()
    sub_id = uuid.uuid4()
    category = SimpleNamespace(id=cat_id, name_da="IT-Support", sort_order=1)
    subcategory = SimpleNamespace(
        id=sub_id,
        category_id=cat_id,
        name_da="Printer",
        sort_order=1,
    )
    cat_scalars = MagicMock()
    cat_scalars.all.return_value = [category]
    sub_scalars = MagicMock()
    sub_scalars.all.return_value = [subcategory]
    mock_session.execute = AsyncMock(
        side_effect=[
            MagicMock(scalars=lambda: cat_scalars),
            MagicMock(scalars=lambda: sub_scalars),
        ]
    )
    with patch.object(mcp_mod, "async_session_factory", session_factory):
        result = await mcp_mod.get_ticket_categories()
    assert "IT-Support" in result
    assert "Printer" in result


@pytest.mark.asyncio
async def test_get_ticket_categories_no_subcategories(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    category = SimpleNamespace(id=uuid.uuid4(), name_da="Generelt", sort_order=1)
    cat_scalars = MagicMock()
    cat_scalars.all.return_value = [category]
    sub_scalars = MagicMock()
    sub_scalars.all.return_value = []
    mock_session.execute = AsyncMock(
        side_effect=[
            MagicMock(scalars=lambda: cat_scalars),
            MagicMock(scalars=lambda: sub_scalars),
        ]
    )
    with patch.object(mcp_mod, "async_session_factory", session_factory):
        result = await mcp_mod.get_ticket_categories()
    assert "Ingen underkategorier" in result


@pytest.mark.asyncio
async def test_get_user_tickets_no_database() -> None:
    with patch.object(mcp_mod, "async_session_factory", None):
        result = await mcp_mod.get_user_tickets("admin@example.dk", caller=FAKE_ADMIN)
    assert "Database" in result


@pytest.mark.asyncio
async def test_get_user_tickets_user_not_found(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    mock_session.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=lambda: None)
    )
    with patch.object(mcp_mod, "async_session_factory", session_factory):
        result = await mcp_mod.get_user_tickets("missing@example.dk", caller=FAKE_ADMIN)
    assert "blev ikke fundet" in result


@pytest.mark.asyncio
async def test_get_user_tickets_lists_recent(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    user = SimpleNamespace(
        id=FAKE_ADMIN.id,
        email="admin@example.dk",
        display_name="Admin Bruger",
    )
    ticket = _fake_ticket()
    mock_session.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: user),
            MagicMock(scalars=lambda: MagicMock(all=lambda: [ticket])),
        ]
    )
    with patch.object(mcp_mod, "async_session_factory", session_factory):
        result = await mcp_mod.get_user_tickets("admin@example.dk", caller=FAKE_ADMIN)
    assert "VPN guide" in result
    assert "INC-2026-00001" in result


@pytest.mark.asyncio
async def test_get_user_tickets_no_tickets(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    user = SimpleNamespace(
        id=FAKE_ADMIN.id,
        email="admin@example.dk",
        display_name="Admin Bruger",
    )
    mock_session.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: user),
            MagicMock(scalars=lambda: MagicMock(all=lambda: [])),
        ]
    )
    with patch.object(mcp_mod, "async_session_factory", session_factory):
        result = await mcp_mod.get_user_tickets("admin@example.dk", caller=FAKE_ADMIN)
    assert "ingen supportsager" in result


@pytest.mark.asyncio
async def test_search_historical_solutions_returns_summaries(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    scalars = MagicMock()
    scalars.all.return_value = [_fake_ticket()]
    mock_session.execute = AsyncMock(return_value=MagicMock(scalars=lambda: scalars))
    with patch.object(mcp_mod, "async_session_factory", session_factory):
        result = await mcp_mod.search_historical_solutions("vpn")
    assert "Reset VPN client" in result
    assert "network" in result


@pytest.mark.asyncio
async def test_search_historical_solutions_empty(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    scalars = MagicMock()
    scalars.all.return_value = []
    mock_session.execute = AsyncMock(return_value=MagicMock(scalars=lambda: scalars))
    with patch.object(mcp_mod, "async_session_factory", session_factory):
        result = await mcp_mod.search_historical_solutions("ost")
    assert "Ingen historiske løsninger" in result


@pytest.mark.asyncio
async def test_create_ticket_validation_errors() -> None:
    with patch.object(mcp_mod, "async_session_factory", _FakeSessionFactory(AsyncMock())):
        short_title = await mcp_mod.create_ticket("ab", "too short desc", caller=FAKE_ADMIN)
        assert "Titlen skal" in short_title
        short_desc = await mcp_mod.create_ticket("Valid title", "short", caller=FAKE_ADMIN)
        assert "Beskrivelsen skal" in short_desc


@pytest.mark.asyncio
async def test_create_ticket_user_not_found(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    mock_session.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=lambda: None)
    )
    with patch.object(mcp_mod, "async_session_factory", session_factory):
        result = await mcp_mod.create_ticket(
            "Printer fejl",
            "Printeren udskriver tomme sider",
            caller=FAKE_ADMIN,
        )
    assert "blev ikke fundet" in result


@pytest.mark.asyncio
async def test_create_ticket_invalid_category_uuid(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    user = SimpleNamespace(id=FAKE_ADMIN.id, email=FAKE_ADMIN.email)
    mock_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: user))
    with patch.object(mcp_mod, "async_session_factory", session_factory):
        result = await mcp_mod.create_ticket(
            "Printer fejl",
            "Printeren udskriver tomme sider",
            category_id="not-a-uuid",
            caller=FAKE_ADMIN,
        )
    assert "Ugyldigt kategori UUID" in result


@pytest.mark.asyncio
async def test_create_ticket_success(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    user = SimpleNamespace(
        id=FAKE_ADMIN.id,
        email=FAKE_ADMIN.email,
        organization_id=uuid.uuid4(),
    )
    mock_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: user))

    routing = SimpleNamespace(
        priority="high",
        assigned_team_id=None,
        assigned_user_id=None,
    )

    async def _refresh(ticket: object) -> None:
        ticket.ticket_number = "INC-2026-00999"  # type: ignore[attr-defined]
        ticket.title = "Printer fejl"  # type: ignore[attr-defined]
        ticket.ticket_type = "incident"  # type: ignore[attr-defined]
        ticket.priority = "high"  # type: ignore[attr-defined]
        ticket.status = "new"  # type: ignore[attr-defined]

    mock_session.refresh = AsyncMock(side_effect=_refresh)

    with (
        patch.object(mcp_mod, "async_session_factory", session_factory),
        patch(
            "star_itsm_api.services.routing.apply_routing",
            AsyncMock(return_value=routing),
        ),
        patch(
            "star_itsm_api.services.ticket_numbers.generate_ticket_number",
            AsyncMock(return_value="INC-2026-00999"),
        ),
        patch(
            "star_itsm_api.services.ticket_security.resolve_create_security_flag",
            return_value=False,
        ),
        patch(
            "star_itsm_api.services.org_access.get_user_organization_id",
            return_value=user.organization_id,
        ),
    ):
        result = await mcp_mod.create_ticket(
            "Printer fejl",
            "Printeren udskriver tomme sider",
            priority="high",
            caller=FAKE_ADMIN,
        )
    assert "oprettet med succes" in result
    assert "INC-2026-00999" in result
    mock_session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_get_ticket_by_number_not_found(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    mock_session.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=lambda: None)
    )
    with patch.object(mcp_mod, "async_session_factory", session_factory):
        result = await mcp_mod.get_ticket_by_number("INC-2026-00001", caller=FAKE_ADMIN)
    assert "Ingen sag fundet" in result


@pytest.mark.asyncio
async def test_get_ticket_by_number_forbidden(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    ticket = _fake_ticket()
    mock_session.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=lambda: ticket)
    )
    with (
        patch.object(mcp_mod, "async_session_factory", session_factory),
        patch.object(
            mcp_mod,
            "user_can_access_ticket",
            AsyncMock(return_value=False),
        ),
    ):
        result = await mcp_mod.get_ticket_by_number("INC-2026-00001", caller=FAKE_ADMIN)
    assert "ikke adgang" in result


@pytest.mark.asyncio
async def test_get_ticket_by_number_success(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    ticket = _fake_ticket(description="Lang beskrivelse " * 50)
    reporter = SimpleNamespace(display_name="Anna", email="anna@example.dk")
    mock_session.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: ticket),
            MagicMock(scalar_one_or_none=lambda: reporter),
        ]
    )
    with (
        patch.object(mcp_mod, "async_session_factory", session_factory),
        patch.object(
            mcp_mod,
            "user_can_access_ticket",
            AsyncMock(return_value=True),
        ),
    ):
        result = await mcp_mod.get_ticket_by_number("inc-2026-00001", caller=FAKE_ADMIN)
    assert "VPN guide" in result
    assert "Anna" in result
    assert "…" in result


@pytest.mark.asyncio
async def test_get_ticket_by_number_empty_input() -> None:
    with patch.object(mcp_mod, "async_session_factory", _FakeSessionFactory(AsyncMock())):
        result = await mcp_mod.get_ticket_by_number("   ", caller=FAKE_ADMIN)
    assert "gyldigt sagsnummer" in result


@pytest.mark.asyncio
async def test_update_ticket_status_invalid_status() -> None:
    with patch.object(mcp_mod, "async_session_factory", _FakeSessionFactory(AsyncMock())):
        result = await mcp_mod.update_ticket_status(
            "INC-2026-00001",
            "bogus",
            caller=FAKE_ADMIN,
        )
    assert "Ugyldig status" in result


@pytest.mark.asyncio
async def test_update_ticket_status_non_staff_rejected() -> None:
    end_user = SimpleNamespace(
        id=uuid.uuid4(),
        email="sf01@example.dk",
        display_name="Anna",
        role="end_user",
    )
    with patch.object(mcp_mod, "async_session_factory", _FakeSessionFactory(AsyncMock())):
        result = await mcp_mod.update_ticket_status(
            "INC-2026-00001",
            "closed",
            caller=end_user,
        )
    assert "Kun medarbejdere" in result


@pytest.mark.asyncio
async def test_update_ticket_status_success_with_note(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    ticket = _fake_ticket(status="in_progress")
    mock_session.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=lambda: ticket)
    )
    with (
        patch.object(mcp_mod, "async_session_factory", session_factory),
        patch(
            "star_itsm_api.services.org_access.user_can_access_ticket",
            AsyncMock(return_value=True),
        ),
        patch(
            "star_itsm_api.services.ticket_timestamps.apply_status_milestone_timestamps",
        ),
    ):
        result = await mcp_mod.update_ticket_status(
            "INC-2026-00001",
            "resolved",
            note="Løst via telefon",
            caller=FAKE_ADMIN,
        )
    assert "opdateret" in result.lower()
    assert "resolved" in result
    assert "Løst via telefon" in result
    mock_session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_update_ticket_status_ticket_not_found(
    mock_session: AsyncMock,
    session_factory: _FakeSessionFactory,
) -> None:
    mock_session.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=lambda: None)
    )
    with patch.object(mcp_mod, "async_session_factory", session_factory):
        result = await mcp_mod.update_ticket_status(
            "INC-2026-00001",
            "closed",
            caller=FAKE_ADMIN,
        )
    assert "Ingen sag fundet" in result
