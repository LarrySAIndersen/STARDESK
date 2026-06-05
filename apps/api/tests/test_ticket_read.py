import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.core.constants import SYSTEM_USER_ID
from star_itsm_api.models.category import Category, Subcategory
from star_itsm_api.models.team import Team
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.schemas.sub_cause import SubCauseRead
from star_itsm_api.schemas.ticket import TicketRead, TicketSummaryRead
from star_itsm_api.services import ticket_read


def create_mock_ticket(ticket_id=None, reporter_id=None):
    ticket_id = ticket_id or uuid.uuid4()
    reporter_id = reporter_id or uuid.uuid4()
    return SimpleNamespace(
        id=ticket_id,
        ticket_number="INC-2026-00001",
        title="Printer virker ikke",
        status="new",
        priority="medium",
        ticket_type="incident",
        is_major=False,
        is_shared=False,
        is_security_ticket=False,
        parent_ticket_id=None,
        category_id=None,
        subcategory_id=None,
        assigned_team_id=None,
        assigned_user_id=None,
        description="Printeren er i stykker",
        reporter_user_id=reporter_id,
        response_due_at=None,
        resolution_due_at=None,
        created_at=datetime(2026, 6, 1, tzinfo=UTC),
        updated_at=None,
        fault_displayed=False,
        tags=[],
        emoji=None,
        source="portal",
        knowledge_status=None,
        knowledge_visibility=None,
    )


def create_mock_ticket_read_pydantic(ticket_id=None, reporter_id=None):
    ticket_id = ticket_id or uuid.uuid4()
    reporter_id = reporter_id or uuid.uuid4()
    return TicketRead(
        id=ticket_id,
        ticket_number="INC-2026-00001",
        title="Printer virker ikke",
        status="new",
        priority="medium",
        ticket_type="incident",
        is_major=False,
        is_shared=False,
        is_security_ticket=False,
        parent_ticket_id=None,
        category_name_da=None,
        subcategory_name_da=None,
        assigned_team_id=None,
        assigned_team_name=None,
        assigned_user_id=None,
        assigned_user_name=None,
        description="Printeren er i stykker",
        reporter_user_id=reporter_id,
        reporter_display_name="Anna",
        response_due_at=None,
        resolution_due_at=None,
        sla_remaining_seconds=None,
        sla_breached=False,
        created_at=datetime(2026, 6, 1, tzinfo=UTC),
        updated_at=None,
        fault_displayed=False,
        tags=[],
        emoji=None,
        source="portal",
        is_knowledge_article=False,
        knowledge_status=None,
        knowledge_status_label_da=None,
        knowledge_visibility=None,
        knowledge_visibility_label_da=None,
    )


def test_fallback_ticket_read_minimal_payload() -> None:
    ticket = SimpleNamespace(
        id=uuid.uuid4(),
        ticket_number="INC-2026-00001",
        title="Printer virker ikke",
        status="new",
        priority="medium",
        ticket_type="incident",
        is_major=False,
        is_shared=False,
        is_security_ticket=False,
        parent_ticket_id=None,
        assigned_team_id=None,
        reporter_user_id=uuid.uuid4(),
        response_due_at=None,
        resolution_due_at=None,
        created_at=datetime(2026, 6, 1, tzinfo=UTC),
        updated_at=None,
        fault_displayed=False,
        tags=[],
        emoji=None,
        source="portal",
    )
    read = ticket_read._fallback_ticket_read(ticket, reporter_display_name="Anna")
    assert read.ticket_number == "INC-2026-00001"
    assert read.reporter_display_name == "Anna"
    assert read.source == "portal"


@pytest.mark.asyncio
async def test_load_user_display_names_empty_set() -> None:
    mock_db = AsyncMock()
    names = await ticket_read.load_user_display_names(mock_db, set())
    assert names == {}
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_load_user_display_names_includes_system_user() -> None:
    user = User()
    user.id = uuid.uuid4()
    user.display_name = "Borger"

    result = MagicMock()
    result.scalars.return_value.all.return_value = [user]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=result)

    names = await ticket_read.load_user_display_names(mock_db, {user.id, SYSTEM_USER_ID})

    assert names[user.id] == "Borger"
    assert names[SYSTEM_USER_ID] == "System"


@pytest.mark.asyncio
async def test_load_user_display_names_on_failure_still_maps_system() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=RuntimeError("timeout"))
    mock_db.rollback = AsyncMock()

    names = await ticket_read.load_user_display_names(mock_db, {SYSTEM_USER_ID})

    assert names == {SYSTEM_USER_ID: "System"}


@pytest.mark.asyncio
async def test_load_user_display_names_on_failure_with_other_user() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=RuntimeError("timeout"))
    mock_db.rollback = AsyncMock()

    other_id = uuid.uuid4()
    names = await ticket_read.load_user_display_names(mock_db, {SYSTEM_USER_ID, other_id})

    assert names[SYSTEM_USER_ID] == "System"
    assert other_id not in names
    mock_db.rollback.assert_called_once()


@pytest.mark.asyncio
async def test_resolve_reporter_display_name() -> None:
    reporter_id = uuid.uuid4()
    user = User()
    user.id = reporter_id
    user.display_name = "Jane Doe"

    result = MagicMock()
    result.scalars.return_value.all.return_value = [user]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=result)

    name = await ticket_read.resolve_reporter_display_name(mock_db, reporter_id)
    assert name == "Jane Doe"


@pytest.mark.asyncio
async def test_load_list_context_success() -> None:
    category_id = uuid.uuid4()
    subcategory_id = uuid.uuid4()
    team_id = uuid.uuid4()
    user_id = uuid.uuid4()
    reporter_id = uuid.uuid4()
    ticket_id = uuid.uuid4()

    ticket = SimpleNamespace(
        id=ticket_id,
        category_id=category_id,
        subcategory_id=subcategory_id,
        assigned_team_id=team_id,
        assigned_user_id=user_id,
        reporter_user_id=reporter_id,
    )

    mock_db = AsyncMock()

    def mock_execute_side_effect(query, *args, **kwargs):
        entity_types = [desc["type"] for desc in query.column_descriptions if desc.get("type")]
        result = MagicMock()
        if Category in entity_types:
            cat = MagicMock()
            cat.id = category_id
            cat.name_da = "Kategori A"
            result.scalars.return_value.all.return_value = [cat]
        elif Subcategory in entity_types:
            subcat = MagicMock()
            subcat.id = subcategory_id
            subcat.name_da = "Subkategori A"
            result.scalars.return_value.all.return_value = [subcat]
        elif Team in entity_types:
            team = MagicMock()
            team.id = team_id
            team.name = "Team A"
            result.scalars.return_value.all.return_value = [team]
        elif User in entity_types:
            u = MagicMock()
            u.id = user_id
            u.display_name = "User A"
            result.scalars.return_value.all.return_value = [u]
        else:
            result.scalars.return_value.all.return_value = []
        return result

    mock_db.execute.side_effect = mock_execute_side_effect

    sub_cause = SubCauseRead(id=uuid.uuid4(), category_id=None, name="Cause A", name_da="Årsag A")
    sub_map_mock = {ticket_id: [sub_cause]}

    with patch("star_itsm_api.services.ticket_read.get_sub_causes_by_ticket_ids", return_value=sub_map_mock):
        sub_map, categories, subcategories, teams, users = await ticket_read._load_list_context(
            mock_db, [ticket]
        )

    assert sub_map == sub_map_mock
    assert categories[category_id] == "Kategori A"
    assert subcategories[subcategory_id] == "Subkategori A"
    assert teams[team_id] == "Team A"
    assert users[user_id] == "User A"


@pytest.mark.asyncio
async def test_load_list_context_empty_and_all_none() -> None:
    mock_db = AsyncMock()
    # 1. Empty list
    sub_map, categories, subcategories, teams, users = await ticket_read._load_list_context(mock_db, [])
    assert sub_map == {}
    assert categories == {}

    # 2. Ticket with all foreign keys as None
    ticket = SimpleNamespace(
        id=uuid.uuid4(),
        category_id=None,
        subcategory_id=None,
        assigned_team_id=None,
        assigned_user_id=None,
        reporter_user_id=uuid.uuid4(),
    )
    user_id = ticket.reporter_user_id

    def mock_execute_side_effect(query, *args, **kwargs):
        entity_types = [desc["type"] for desc in query.column_descriptions if desc.get("type")]
        result = MagicMock()
        if User in entity_types:
            u = MagicMock()
            u.id = user_id
            u.display_name = "Reporter A"
            result.scalars.return_value.all.return_value = [u]
        else:
            result.scalars.return_value.all.return_value = []
        return result

    mock_db.execute.side_effect = mock_execute_side_effect

    with patch("star_itsm_api.services.ticket_read.get_sub_causes_by_ticket_ids", return_value={}):
        sub_map, categories, subcategories, teams, users = await ticket_read._load_list_context(
            mock_db, [ticket]
        )

    assert sub_map == {}
    assert categories == {}
    assert subcategories == {}
    assert teams == {}
    assert users[user_id] == "Reporter A"


@pytest.mark.asyncio
async def test_load_hierarchy_context_success() -> None:
    parent_id = uuid.uuid4()
    ticket_id = uuid.uuid4()

    ticket = SimpleNamespace(
        id=ticket_id,
        parent_ticket_id=parent_id,
    )

    mock_db = AsyncMock()

    def mock_execute_side_effect(query, *args, **kwargs):
        entity_types = [desc["type"] for desc in query.column_descriptions if desc.get("type")]
        result = MagicMock()
        if Ticket in entity_types:
            parent = MagicMock()
            parent.id = parent_id
            parent.ticket_number = "INC-P"
            parent.title = "Parent Title"
            parent.status = "open"
            parent.priority = "high"
            parent.is_major = True
            result.scalars.return_value.all.return_value = [parent]
        else:
            result.all.return_value = [(parent_id, 3)]
        return result

    mock_db.execute.side_effect = mock_execute_side_effect

    parents, child_counts = await ticket_read._load_hierarchy_context(mock_db, [ticket])

    assert parent_id in parents
    assert parents[parent_id].ticket_number == "INC-P"
    assert child_counts[parent_id] == 3


@pytest.mark.asyncio
async def test_load_hierarchy_context_empty_and_no_parents() -> None:
    mock_db = AsyncMock()
    # 1. Empty list
    parents, child_counts = await ticket_read._load_hierarchy_context(mock_db, [])
    assert parents == {}
    assert child_counts == {}

    # 2. No parent ticket id and some None parent_id in count_rows
    ticket = SimpleNamespace(id=uuid.uuid4(), parent_ticket_id=None)

    def mock_execute_side_effect(query, *args, **kwargs):
        result = MagicMock()
        result.all.return_value = [(None, 5)]
        return result

    mock_db.execute.side_effect = mock_execute_side_effect

    parents, child_counts = await ticket_read._load_hierarchy_context(mock_db, [ticket])
    assert parents == {}
    assert child_counts == {}


@pytest.mark.asyncio
async def test_load_engagement_counts_success() -> None:
    ticket_id = uuid.uuid4()
    mock_db = AsyncMock()

    def mock_execute_side_effect(query, *args, **kwargs):
        query_str = str(query).lower()
        result = MagicMock()
        if "attachment" in query_str:
            result.all.return_value = [(ticket_id, 5)]
        elif "comment" in query_str:
            if "is_internal" in query_str:
                result.all.return_value = [(ticket_id, 2)]
            else:
                result.all.return_value = [(ticket_id, 4)]
        return result

    mock_db.execute.side_effect = mock_execute_side_effect

    comment_counts, internal_counts, attachment_counts = await ticket_read._load_engagement_counts(
        mock_db, [ticket_id]
    )

    assert comment_counts[ticket_id] == 4
    assert internal_counts[ticket_id] == 2
    assert attachment_counts[ticket_id] == 5


@pytest.mark.asyncio
async def test_load_engagement_counts_failure() -> None:
    ticket_id = uuid.uuid4()
    mock_db = AsyncMock()
    mock_db.execute.side_effect = RuntimeError("DB error")
    mock_db.rollback = AsyncMock()

    comment_counts, internal_counts, attachment_counts = await ticket_read._load_engagement_counts(
        mock_db, [ticket_id]
    )

    assert comment_counts == {}
    assert internal_counts == {}
    assert attachment_counts == {}
    mock_db.rollback.assert_called_once()


@pytest.mark.asyncio
async def test_load_engagement_counts_empty_and_none_ticket_id() -> None:
    mock_db = AsyncMock()
    # 1. Empty list
    c, i, a = await ticket_read._load_engagement_counts(mock_db, [])
    assert c == {}
    assert i == {}
    assert a == {}

    # 2. Query returns None for ticket_id
    def mock_execute_side_effect(query, *args, **kwargs):
        result = MagicMock()
        result.all.return_value = [(None, 5)]
        return result

    mock_db.execute.side_effect = mock_execute_side_effect

    c, i, a = await ticket_read._load_engagement_counts(mock_db, [uuid.uuid4()])
    assert c == {}
    assert i == {}
    assert a == {}


@pytest.mark.asyncio
async def test_ticket_to_read_mapping() -> None:
    ticket_id = uuid.uuid4()
    reporter_id = uuid.uuid4()
    category_id = uuid.uuid4()
    subcategory_id = uuid.uuid4()
    team_id = uuid.uuid4()
    user_id = uuid.uuid4()

    ticket = SimpleNamespace(
        id=ticket_id,
        ticket_number="INC-1",
        title="My Ticket",
        status="open",
        priority="low",
        ticket_type="problem",
        category_id=category_id,
        subcategory_id=subcategory_id,
        assigned_team_id=team_id,
        assigned_user_id=user_id,
        reporter_user_id=reporter_id,
        description="Ticket desc",
        created_at=datetime(2026, 6, 1, tzinfo=UTC),
        updated_at=datetime(2026, 6, 2, tzinfo=UTC),
        fault_displayed=True,
        tags=["tag1"],
        emoji="😀",
        is_knowledge_article=True,
        knowledge_status="published",
        knowledge_visibility="public",
        source="email",
    )

    categories = {category_id: "Kategori"}
    subcategories = {subcategory_id: "Subkategori"}
    teams = {team_id: "Team"}
    users = {user_id: "User", reporter_id: "Reporter"}

    parent_summary = TicketSummaryRead(
        id=uuid.uuid4(), ticket_number="P-1", title="Parent", status="open", priority="high"
    )
    ticket.parent_ticket_id = uuid.uuid4()
    parents = {ticket.parent_ticket_id: parent_summary}

    child_counts = {ticket_id: 2}

    from star_itsm_api.services.ticket_routing import _TeamRef
    active_teams = [_TeamRef(id=team_id, name="Team")]

    sla_fields = {
        "response_due_at": datetime(2026, 6, 3, tzinfo=UTC),
        "resolution_due_at": datetime(2026, 6, 4, tzinfo=UTC),
        "sla_remaining_seconds": 120,
        "sla_breached": True,
    }

    with patch("star_itsm_api.services.ticket_read.sla_fields_for_ticket", return_value=sla_fields), \
         patch("star_itsm_api.services.ticket_read.build_ticket_routing", return_value=None):

         read = ticket_read._ticket_to_read(
             ticket,
             sub_causes=[],
             categories=categories,
             subcategories=subcategories,
             teams=teams,
             users=users,
             parents=parents,
             child_counts=child_counts,
             active_teams=active_teams,
             comment_count=10,
             internal_comment_count=3,
             attachment_count=4,
         )

    assert read.ticket_number == "INC-1"
    assert read.category_name_da == "Kategori"
    assert read.subcategory_name_da == "Subkategori"
    assert read.assigned_team_name == "Team"
    assert read.assigned_user_name == "User"
    assert read.reporter_display_name == "Reporter"
    assert read.parent.ticket_number == "P-1"
    assert read.child_count == 2
    assert read.comment_count == 10
    assert read.internal_comment_count == 3
    assert read.attachment_count == 4
    assert read.knowledge_status == "published"
    assert read.source == "email"


@pytest.mark.asyncio
async def test_load_active_teams_caching() -> None:
    import star_itsm_api.services.ticket_read as tr_mod
    tr_mod._active_teams_cache = None

    team = Team()
    team.id = uuid.uuid4()
    team.name = "My Team"
    team.is_active = True

    result = MagicMock()
    result.scalars.return_value.all.return_value = [team]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=result)

    teams = await tr_mod._load_active_teams(mock_db)
    assert len(teams) == 1
    assert teams[0].name == "My Team"
    mock_db.execute.assert_called_once()

    mock_db.execute.reset_mock()
    teams2 = await tr_mod._load_active_teams(mock_db)
    assert teams2 == teams
    mock_db.execute.assert_not_called()

    tr_mod._active_teams_cache = (0.0, teams)
    mock_db.execute.reset_mock()
    teams3 = await tr_mod._load_active_teams(mock_db)
    assert len(teams3) == 1
    mock_db.execute.assert_called_once()


@pytest.mark.asyncio
async def test_tickets_to_read_list_empty() -> None:
    mock_db = AsyncMock()
    reads = await ticket_read.tickets_to_read_list(mock_db, [])
    assert reads == []


@pytest.mark.asyncio
async def test_tickets_to_read_list_success() -> None:
    ticket = create_mock_ticket()
    mock_db = AsyncMock()

    sub_cause = SubCauseRead(id=uuid.uuid4(), category_id=None, name="Cause", name_da="Desc")
    with patch("star_itsm_api.services.ticket_read._load_list_context", return_value=({ticket.id: [sub_cause]}, {}, {}, {}, {ticket.reporter_user_id: "Reporter"})), \
         patch("star_itsm_api.services.ticket_read._load_hierarchy_context", return_value=({}, {})), \
         patch("star_itsm_api.services.ticket_read._load_engagement_counts", return_value=({}, {}, {})), \
         patch("star_itsm_api.services.ticket_read._load_active_teams", return_value=[]), \
         patch("star_itsm_api.services.ticket_read.get_sla_runtime_settings", return_value=None), \
         patch("star_itsm_api.services.ticket_read.sla_fields_for_ticket", return_value={"response_due_at": None, "resolution_due_at": None, "sla_remaining_seconds": None, "sla_breached": False}), \
         patch("star_itsm_api.services.ticket_read.build_ticket_routing", return_value=None):

         reads = await ticket_read.tickets_to_read_list(mock_db, [ticket])
         assert len(reads) == 1
         assert reads[0].ticket_number == ticket.ticket_number
         assert reads[0].reporter_display_name == "Reporter"
         assert reads[0].sub_causes == [sub_cause]


@pytest.mark.asyncio
async def test_tickets_to_read_list_context_exception() -> None:
    ticket = create_mock_ticket()
    mock_db = AsyncMock()
    mock_db.rollback = AsyncMock()

    with patch("star_itsm_api.services.ticket_read._load_list_context", side_effect=RuntimeError("context failure")), \
         patch("star_itsm_api.services.ticket_read._fallback_ticket_read_async") as mock_fallback:

         mock_fallback.return_value = create_mock_ticket_read_pydantic(ticket.id)

         reads = await ticket_read.tickets_to_read_list(mock_db, [ticket])
         assert len(reads) == 1
         mock_db.rollback.assert_called_once()
         mock_fallback.assert_awaited_once_with(mock_db, ticket)


@pytest.mark.asyncio
async def test_tickets_to_read_list_single_ticket_serialization_exception() -> None:
    ticket1 = create_mock_ticket()
    ticket2 = create_mock_ticket()
    mock_db = AsyncMock()

    with patch("star_itsm_api.services.ticket_read._load_list_context", return_value=({}, {}, {}, {}, {})), \
         patch("star_itsm_api.services.ticket_read._load_hierarchy_context", return_value=({}, {})), \
         patch("star_itsm_api.services.ticket_read._load_engagement_counts", return_value=({}, {}, {})), \
         patch("star_itsm_api.services.ticket_read._load_active_teams", return_value=[]), \
         patch("star_itsm_api.services.ticket_read.get_sla_runtime_settings", return_value=None), \
         patch("star_itsm_api.services.ticket_read._ticket_to_read") as mock_to_read, \
         patch("star_itsm_api.services.ticket_read._fallback_ticket_read_async") as mock_fallback:

         mock_to_read.side_effect = [create_mock_ticket_read_pydantic(ticket1.id), RuntimeError("serialisation fail")]
         mock_fallback.return_value = create_mock_ticket_read_pydantic(ticket2.id)

         reads = await ticket_read.tickets_to_read_list(mock_db, [ticket1, ticket2])
         assert len(reads) == 2
         assert reads[0].id == ticket1.id
         assert reads[1].id == ticket2.id
         mock_fallback.assert_awaited_once_with(mock_db, ticket2)


@pytest.mark.asyncio
async def test_ticket_hierarchy_detail_extras_on_failure_returns_empty() -> None:
    mock_db = AsyncMock()
    mock_db.execute = MagicMock(side_effect=RuntimeError("db"))
    mock_db.rollback = AsyncMock()
    ticket = SimpleNamespace(id=uuid.uuid4(), is_major=False, parent_ticket_id=None)

    extras = await ticket_read.ticket_hierarchy_detail_extras(mock_db, ticket)

    assert extras == {"children": [], "related_major_tickets": []}


@pytest.mark.asyncio
async def test_ticket_hierarchy_detail_extras_happy_path() -> None:
    ticket_id = uuid.uuid4()
    ticket = SimpleNamespace(
        id=ticket_id,
        is_major=True,
        parent_ticket_id=None,
    )
    mock_db = AsyncMock()

    child_ticket = create_mock_ticket(ticket_id=uuid.uuid4())
    related_ticket = create_mock_ticket(ticket_id=uuid.uuid4())

    with patch("star_itsm_api.services.ticket_read.get_child_tickets", return_value=[child_ticket]) as mock_get_children, \
         patch("star_itsm_api.services.ticket_read.get_related_major_tickets", return_value=[related_ticket]) as mock_get_related, \
         patch("star_itsm_api.services.ticket_read.tickets_to_summaries") as mock_to_summaries:

         summary1 = TicketSummaryRead(id=child_ticket.id, ticket_number="INC-1", title="Child", status="new", priority="low")
         summary2 = TicketSummaryRead(id=related_ticket.id, ticket_number="INC-2", title="Related", status="new", priority="low")
         mock_to_summaries.side_effect = [[summary2], [summary1]]

         extras = await ticket_read.ticket_hierarchy_detail_extras(mock_db, ticket)

         assert extras["children"] == [summary1]
         assert extras["related_major_tickets"] == [summary2]
         mock_get_children.assert_awaited_once_with(mock_db, ticket_id)
         mock_get_related.assert_awaited_once_with(mock_db, ticket_id)


@pytest.mark.asyncio
async def test_ticket_hierarchy_detail_extras_is_major_with_parent() -> None:
    ticket = SimpleNamespace(
        id=uuid.uuid4(),
        is_major=True,
        parent_ticket_id=uuid.uuid4(),
    )
    mock_db = AsyncMock()

    with patch("star_itsm_api.services.ticket_read.get_child_tickets", return_value=[]) as mock_get_children, \
         patch("star_itsm_api.services.ticket_read.get_related_major_tickets") as mock_get_related, \
         patch("star_itsm_api.services.ticket_read.tickets_to_summaries", return_value=[]):

         extras = await ticket_read.ticket_hierarchy_detail_extras(mock_db, ticket)
         assert extras["children"] == []
         assert extras["related_major_tickets"] == []
         mock_get_children.assert_awaited_once_with(mock_db, ticket.id)
         mock_get_related.assert_not_called()


@pytest.mark.asyncio
async def test_fallback_ticket_read_async() -> None:
    ticket = create_mock_ticket()
    mock_db = AsyncMock()

    with patch("star_itsm_api.services.ticket_read.resolve_reporter_display_name", return_value="Reporter Display") as mock_resolve:
        read = await ticket_read._fallback_ticket_read_async(mock_db, ticket)
        assert read.reporter_display_name == "Reporter Display"
        mock_resolve.assert_awaited_once_with(mock_db, ticket.reporter_user_id)


@pytest.mark.asyncio
async def test_ticket_to_read_reporter_display_name_states() -> None:
    ticket = create_mock_ticket()
    mock_db = AsyncMock()

    read_pydantic_1 = create_mock_ticket_read_pydantic(ticket.id)
    read_pydantic_1.reporter_display_name = "Anna"

    with patch("star_itsm_api.services.ticket_read.tickets_to_read_list", return_value=[read_pydantic_1]):
        result = await ticket_read.ticket_to_read(mock_db, ticket)
        assert result.reporter_display_name == "Anna"

    read_pydantic_2 = create_mock_ticket_read_pydantic(ticket.id)
    read_pydantic_2.reporter_display_name = None

    with patch("star_itsm_api.services.ticket_read.tickets_to_read_list", return_value=[read_pydantic_2]), \
         patch("star_itsm_api.services.ticket_read.resolve_reporter_display_name", return_value="Bob") as mock_resolve:

         result = await ticket_read.ticket_to_read(mock_db, ticket)
         assert result.reporter_display_name == "Bob"
         mock_resolve.assert_awaited_once_with(mock_db, ticket.reporter_user_id)

    read_pydantic_3 = create_mock_ticket_read_pydantic(ticket.id)
    read_pydantic_3.reporter_display_name = None

    with patch("star_itsm_api.services.ticket_read.tickets_to_read_list", return_value=[read_pydantic_3]), \
         patch("star_itsm_api.services.ticket_read.resolve_reporter_display_name", return_value=None):

         result = await ticket_read.ticket_to_read(mock_db, ticket)
         assert result.reporter_display_name is None

    with patch("star_itsm_api.services.ticket_read.tickets_to_read_list", side_effect=RuntimeError("serialization fail")), \
         patch("star_itsm_api.services.ticket_read._fallback_ticket_read_async") as mock_fallback:

         fallback_read = create_mock_ticket_read_pydantic(ticket.id)
         mock_fallback.return_value = fallback_read

         result = await ticket_read.ticket_to_read(mock_db, ticket)
         assert result == fallback_read
         mock_fallback.assert_awaited_once_with(mock_db, ticket)


@pytest.mark.asyncio
async def test_ticket_to_detail_read_options() -> None:
    ticket = create_mock_ticket()
    mock_db = AsyncMock()

    base_read = create_mock_ticket_read_pydantic(ticket.id)

    with patch("star_itsm_api.services.ticket_read.ticket_to_read", return_value=base_read) as mock_to_read, \
         patch("star_itsm_api.services.ticket_read.ticket_hierarchy_detail_extras", return_value={"children": []}) as mock_hier:

         extra = {
             "category_id": None,
             "subcategory_id": None,
             "escalation_level": 1,
             "timestamps": {
                 "created_at": datetime(2026, 6, 1, tzinfo=UTC)
             }
         }
         detail = await ticket_read.ticket_to_detail_read(mock_db, ticket, extra=extra, include_hierarchy=True)
         assert detail.id == ticket.id
         assert detail.escalation_level == 1
         mock_to_read.assert_awaited_once_with(mock_db, ticket)
         mock_hier.assert_awaited_once_with(mock_db, ticket)

    with patch("star_itsm_api.services.ticket_read.ticket_to_read", return_value=base_read), \
         patch("star_itsm_api.services.ticket_read.ticket_hierarchy_detail_extras") as mock_hier:

         extra = {
             "category_id": None,
             "subcategory_id": None,
             "escalation_level": 1,
             "timestamps": {
                 "created_at": datetime(2026, 6, 1, tzinfo=UTC)
             }
         }
         detail = await ticket_read.ticket_to_detail_read(mock_db, ticket, extra=extra, include_hierarchy=False)
         assert detail.id == ticket.id
         mock_hier.assert_not_called()


@pytest.mark.asyncio
async def test_ticket_to_detail_read_intelligence_exception() -> None:
    ticket = create_mock_ticket()
    mock_db = AsyncMock()

    base_read = create_mock_ticket_read_pydantic(ticket.id)

    with patch("star_itsm_api.services.ticket_read.ticket_to_read", return_value=base_read), \
         patch("star_itsm_api.services.ticket_read.ticket_hierarchy_detail_extras", return_value={}):

         extra = {
             "category_id": None,
             "subcategory_id": None,
             "escalation_level": 1,
             "timestamps": {
                 "created_at": datetime(2026, 6, 1, tzinfo=UTC)
             },
             "intelligence": "invalid_type_not_model"
         }
         detail = await ticket_read.ticket_to_detail_read(mock_db, ticket, extra=extra, include_hierarchy=True)
         assert detail.id == ticket.id
         assert detail.intelligence is None
         assert detail.escalation_level == 1
