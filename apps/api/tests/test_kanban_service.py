import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.models.kanban import (
    KanbanBoard,
    KanbanBoardMember,
    KanbanBoardTicket,
    KanbanColumn,
)
from star_itsm_api.models.team import Team
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.schemas.kanban import KanbanBoardCreate, KanbanBoardUpdate
from star_itsm_api.services import kanban_service


@pytest.mark.asyncio
async def test_load_member_maps_empty_board_list() -> None:
    mock_db = AsyncMock()
    roles, members = await kanban_service._load_member_maps(mock_db, [])
    assert roles == {}
    assert members == {}
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_team_names_empty_set() -> None:
    mock_db = AsyncMock()
    names = await kanban_service._team_names(mock_db, set())
    assert names == {}
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_list_board_columns_returns_ordered() -> None:
    board_id = uuid.uuid4()
    col = KanbanColumn()
    col.id = uuid.uuid4()
    col.board_id = board_id
    col.name = "Modtaget"
    col.position = 0

    result = MagicMock()
    result.scalars.return_value.all.return_value = [col]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=result)

    columns = await kanban_service._list_board_columns(mock_db, board_id)
    assert len(columns) == 1
    assert columns[0].name == "Modtaget"


@pytest.mark.asyncio
async def test_member_reads_empty() -> None:
    mock_db = AsyncMock()
    result = await kanban_service._member_reads(mock_db, [])
    assert result == []


@pytest.mark.asyncio
async def test_member_reads_with_users() -> None:
    user_id_1 = uuid.uuid4()
    user_id_2 = uuid.uuid4()
    
    member1 = KanbanBoardMember(board_id=uuid.uuid4(), user_id=user_id_1, role="owner")
    member2 = KanbanBoardMember(board_id=uuid.uuid4(), user_id=user_id_2, role="editor")
    
    user1 = User(id=user_id_1, display_name="Alice")
    user2 = User(id=user_id_2, display_name="Bob")
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [user1, user2]
    
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    result = await kanban_service._member_reads(mock_db, [member2, member1])
    assert len(result) == 2
    assert result[0].display_name == "Alice"
    assert result[0].role == "owner"
    assert result[1].display_name == "Bob"
    assert result[1].role == "editor"


def test_board_summary() -> None:
    board_id = uuid.uuid4()
    user_id = uuid.uuid4()
    team_id = uuid.uuid4()
    
    board = KanbanBoard(
        id=board_id,
        name="Test Board",
        description="Test Desc",
        team_id=team_id,
        created_by_user_id=user_id,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    
    summary = kanban_service._board_summary(
        board,
        team_name="Test Team",
        my_role="owner",
    )
    
    assert summary.id == board_id
    assert summary.name == "Test Board"
    assert summary.description == "Test Desc"
    assert summary.team_id == team_id
    assert summary.team_name == "Test Team"
    assert summary.created_by_user_id == user_id
    assert summary.my_role == "owner"


def test_ticket_in_board_scope() -> None:
    board_no_team = KanbanBoard(team_id=None)
    board_with_team = KanbanBoard(team_id=uuid.UUID("00000000-0000-0000-0000-000000000001"))
    
    ticket_team_1 = Ticket(assigned_team_id=uuid.UUID("00000000-0000-0000-0000-000000000001"))
    ticket_team_2 = Ticket(assigned_team_id=uuid.UUID("00000000-0000-0000-0000-000000000002"))
    
    assert kanban_service._ticket_in_board_scope(board_no_team, ticket_team_1) is True
    assert kanban_service._ticket_in_board_scope(board_with_team, ticket_team_1) is True
    assert kanban_service._ticket_in_board_scope(board_with_team, ticket_team_2) is False


@pytest.mark.asyncio
async def test_next_card_position() -> None:
    board_id = uuid.uuid4()
    column_id = uuid.uuid4()
    
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = 5
    
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    pos = await kanban_service._next_card_position(mock_db, board_id, column_id)
    assert pos == 6


@pytest.mark.asyncio
async def test_load_member_maps_with_data() -> None:
    board_id = uuid.uuid4()
    user_id = uuid.uuid4()
    member = KanbanBoardMember(board_id=board_id, user_id=user_id, role="owner")
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [member]
    
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    roles, members = await kanban_service._load_member_maps(mock_db, [board_id])
    assert roles == {board_id: {user_id: "owner"}}
    assert members == {board_id: [member]}


@pytest.mark.asyncio
async def test_team_names_with_data() -> None:
    team_id = uuid.uuid4()
    team = Team(id=team_id, name="Operations")
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [team]
    
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    names = await kanban_service._team_names(mock_db, {team_id})
    assert names == {team_id: "Operations"}


@pytest.mark.asyncio
async def test_get_board_row() -> None:
    board_id = uuid.uuid4()
    board = KanbanBoard(id=board_id, name="My Board")
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=board)
    
    row = await kanban_service.get_board_row(mock_db, board_id)
    assert row == board
    mock_db.get.assert_awaited_once_with(KanbanBoard, board_id)


@pytest.mark.asyncio
async def test_create_board_success() -> None:
    user_id = uuid.uuid4()
    user = User(id=user_id, display_name="Alice")
    
    payload = KanbanBoardCreate(
        name="My New Board",
        description="My Desc",
        team_id=None,
        template="itsm",
        column_names=[],
        member_user_ids=[uuid.uuid4()]
    )
    
    mock_db = AsyncMock()
    mock_db.refresh = AsyncMock()
    
    result = await kanban_service.create_board(mock_db, user, payload)
    
    assert result.name == "My New Board"
    assert result.description == "My Desc"
    assert result.my_role == "owner"
    assert mock_db.add.call_count >= 2
    mock_db.commit.assert_awaited_once()
    mock_db.refresh.assert_awaited_once()


@pytest.mark.asyncio
async def test_member_reads_user_not_found() -> None:
    member = KanbanBoardMember(board_id=uuid.uuid4(), user_id=uuid.uuid4(), role="editor")
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []  # No user found
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    result = await kanban_service._member_reads(mock_db, [member])
    assert result == []


@pytest.mark.asyncio
async def test_require_edit_access_success() -> None:
    board = KanbanBoard(id=uuid.uuid4(), created_by_user_id=uuid.uuid4())
    user = User(id=uuid.uuid4())
    
    with patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock) as mock_req, \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="owner"), \
         patch("star_itsm_api.services.kanban_service.user_can_edit_board", return_value=True):
        
        mock_req.return_value = ({}, [])
        mock_db = AsyncMock()
        role = await kanban_service._require_edit_access(mock_db, board, user)
        assert role == "owner"
        mock_req.assert_awaited_once_with(mock_db, board, user)


@pytest.mark.asyncio
async def test_require_edit_access_forbidden() -> None:
    board = KanbanBoard(id=uuid.uuid4(), created_by_user_id=uuid.uuid4())
    user = User(id=uuid.uuid4())
    
    with patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock) as mock_req, \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="viewer"), \
         patch("star_itsm_api.services.kanban_service.user_can_edit_board", return_value=False):
        
        mock_req.return_value = ({}, [])
        mock_db = AsyncMock()
        with pytest.raises(PermissionError, match="board_forbidden"):
            await kanban_service._require_edit_access(mock_db, board, user)


@pytest.mark.asyncio
async def test_create_ticket_for_board_success() -> None:
    board = KanbanBoard(id=uuid.uuid4(), team_id=uuid.uuid4())
    user = User(id=uuid.uuid4())
    from star_itsm_api.schemas.ticket import TicketCreate
    payload = TicketCreate(
        ticket_type="incident",
        title="Test Ticket",
        description="Description with 10+ chars",
        priority="medium",
        gdpr_consent=True,
        subject_cpr=None,
        is_major=False,
        tags=[],
        emoji=None,
        source="portal",
    )
    
    mock_routing = MagicMock()
    mock_routing.assigned_team_id = None
    mock_routing.priority = "medium"
    mock_routing.assigned_user_id = None
    
    mock_db = AsyncMock()
    
    with patch("star_itsm_api.services.kanban_service.apply_routing", new_callable=AsyncMock, return_value=mock_routing), \
         patch("star_itsm_api.services.kanban_service.generate_ticket_number", new_callable=AsyncMock, return_value="INC-123"), \
         patch("star_itsm_api.services.kanban_service.is_staff", return_value=True), \
         patch("star_itsm_api.services.kanban_service.get_user_organization_id", return_value=uuid.uuid4()), \
         patch("star_itsm_api.services.kanban_service.apply_sla_to_ticket", new_callable=AsyncMock), \
         patch("star_itsm_api.services.kanban_service.maybe_set_assigned_at") as mock_assigned:
        
        ticket = await kanban_service._create_ticket_for_board(mock_db, user, payload, board=board)
        assert ticket.ticket_number == "INC-123"
        assert ticket.title == "Test Ticket"
        assert ticket.status == "assigned"  # because board.team_id was copied to assigned_team_id
        assert ticket.assigned_team_id == board.team_id
        mock_assigned.assert_called_once()
        mock_db.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_list_boards_sees_all() -> None:
    user = User(id=uuid.uuid4())
    board = KanbanBoard(
        id=uuid.uuid4(),
        name="Board A",
        team_id=None,
        created_by_user_id=uuid.uuid4(),
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    
    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.all.side_effect = [
        [board],  # for boards query
        []  # for load_member_maps (members rows)
    ]
    
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_execute_result)
    
    with patch("star_itsm_api.services.kanban_service.sees_all_boards", return_value=True) as mock_sees, \
         patch("star_itsm_api.services.kanban_service._load_member_maps", new_callable=AsyncMock, return_value=({}, {})), \
         patch("star_itsm_api.services.kanban_service._team_names", new_callable=AsyncMock, return_value={}), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="owner"):
        
        summaries = await kanban_service.list_boards(mock_db, user)
        assert len(summaries) == 1
        assert summaries[0].name == "Board A"
        mock_sees.assert_called_once_with(user)


@pytest.mark.asyncio
async def test_list_boards_restricted() -> None:
    user = User(id=uuid.uuid4())
    board = KanbanBoard(
        id=uuid.uuid4(),
        name="Board B",
        team_id=None,
        created_by_user_id=uuid.uuid4(),
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    
    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.all.side_effect = [
        [board.id],  # member board ids
        [board],     # boards query
    ]
    
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_execute_result)
    
    with patch("star_itsm_api.services.kanban_service.sees_all_boards", return_value=False) as mock_sees, \
         patch("star_itsm_api.services.kanban_service._load_member_maps", new_callable=AsyncMock, return_value=({}, {})), \
         patch("star_itsm_api.services.kanban_service._team_names", new_callable=AsyncMock, return_value={}), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="editor"):
        
        summaries = await kanban_service.list_boards(mock_db, user)
        assert len(summaries) == 1
        assert summaries[0].name == "Board B"
        mock_sees.assert_called_once_with(user)


@pytest.mark.asyncio
async def test_get_board_row_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)
    res = await kanban_service.get_board_row(mock_db, uuid.uuid4())
    assert res is None


@pytest.mark.asyncio
async def test_get_board_row_deleted() -> None:
    board = KanbanBoard(id=uuid.uuid4(), deleted_at=datetime.now())
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=board)
    res = await kanban_service.get_board_row(mock_db, uuid.uuid4())
    assert res is None


@pytest.mark.asyncio
async def test_require_board_access_success() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    user = User(id=uuid.uuid4())
    member = KanbanBoardMember(board_id=board.id, user_id=user.id, role="editor")
    
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service._load_member_maps", new_callable=AsyncMock) as mock_load, \
         patch("star_itsm_api.services.kanban_service.user_can_view_board", return_value=True):
        
        mock_load.return_value = ({board.id: {user.id: "editor"}}, {board.id: [member]})
        roles, members = await kanban_service._require_board_access(mock_db, board, user)
        assert roles == {user.id: "editor"}
        assert members == [member]


@pytest.mark.asyncio
async def test_require_board_access_forbidden() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    user = User(id=uuid.uuid4())
    
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service._load_member_maps", new_callable=AsyncMock) as mock_load, \
         patch("star_itsm_api.services.kanban_service.user_can_view_board", return_value=False):
        
        mock_load.return_value = ({board.id: {}}, {board.id: []})
        with pytest.raises(PermissionError, match="board_forbidden"):
            await kanban_service._require_board_access(mock_db, board, user)


@pytest.mark.asyncio
async def test_create_board_with_team_and_self_member() -> None:
    user_id = uuid.uuid4()
    user = User(id=user_id, display_name="Alice")
    team_id = uuid.uuid4()
    team = Team(id=team_id, name="Operations")
    
    payload = KanbanBoardCreate(
        name="Board with Team",
        description="Desc",
        team_id=team_id,
        template="itsm",
        column_names=[],
        member_user_ids=[user_id, uuid.uuid4()]  # includes self
    )
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=team)
    
    result = await kanban_service.create_board(mock_db, user, payload)
    assert result.name == "Board with Team"
    assert result.team_name == "Operations"
    assert mock_db.add.call_count >= 2


@pytest.mark.asyncio
async def test_update_board_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)
    payload = KanbanBoardUpdate()
    
    with pytest.raises(LookupError, match="board_not_found"):
        await kanban_service.update_board(mock_db, User(id=uuid.uuid4()), uuid.uuid4(), payload)


@pytest.mark.asyncio
async def test_update_board_forbidden() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    user = User(id=uuid.uuid4())
    payload = KanbanBoardUpdate()
    
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="viewer"), \
         patch("star_itsm_api.services.kanban_service.user_can_edit_board", return_value=False):
        
        with pytest.raises(PermissionError, match="board_forbidden"):
            await kanban_service.update_board(mock_db, user, board.id, payload)


@pytest.mark.asyncio
async def test_update_board_success() -> None:
    board_id = uuid.uuid4()
    team_id = uuid.uuid4()
    board = KanbanBoard(
        id=board_id,
        name="Old Name",
        description="Old Desc",
        team_id=None,
        created_by_user_id=uuid.uuid4(),
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    team = Team(id=team_id, name="Devs")
    user = User(id=uuid.uuid4())
    
    from star_itsm_api.schemas.kanban import KanbanBoardMemberWrite
    payload = KanbanBoardUpdate(
        name="New Name",
        description="New Desc",
        team_id=team_id,
        members=[KanbanBoardMemberWrite(user_id=uuid.uuid4(), role="editor")]
    )
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=team)
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="owner"), \
         patch("star_itsm_api.services.kanban_service.user_can_edit_board", return_value=True), \
         patch("star_itsm_api.services.kanban_service._sync_members", new_callable=AsyncMock) as mock_sync, \
         patch("star_itsm_api.services.kanban_service._load_member_maps", new_callable=AsyncMock, return_value=({}, {})):
        
        result = await kanban_service.update_board(mock_db, user, board_id, payload)
        assert result.name == "New Name"
        assert result.description == "New Desc"
        assert result.team_name == "Devs"
        mock_sync.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_board_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)
    with pytest.raises(LookupError, match="board_not_found"):
        await kanban_service.delete_board(mock_db, User(id=uuid.uuid4()), uuid.uuid4())


@pytest.mark.asyncio
async def test_delete_board_forbidden() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="editor"), \
         patch("star_itsm_api.services.kanban_service.user_can_delete_board", return_value=False):
        
        with pytest.raises(PermissionError, match="board_forbidden"):
            await kanban_service.delete_board(mock_db, user, board.id)


@pytest.mark.asyncio
async def test_delete_board_success() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    user = User(id=uuid.uuid4())
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="owner"), \
         patch("star_itsm_api.services.kanban_service.user_can_delete_board", return_value=True):
        
        await kanban_service.delete_board(mock_db, user, board.id)
        assert board.deleted_at is not None
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_sync_members() -> None:
    board_id = uuid.uuid4()
    creator_id = uuid.uuid4()
    board = KanbanBoard(id=board_id, created_by_user_id=creator_id)
    
    from star_itsm_api.schemas.kanban import KanbanBoardMemberWrite
    member_id = uuid.uuid4()
    members = [
        KanbanBoardMemberWrite(user_id=member_id, role="editor"),
        KanbanBoardMemberWrite(user_id=member_id, role="editor"),  # duplicate
        KanbanBoardMemberWrite(user_id=creator_id, role="editor"),  # creator
    ]
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=board)
    
    await kanban_service._sync_members(mock_db, board_id, members, now=datetime.now())
    # Should delete old members, and add:
    # 1. creator as owner (from creator_id presence)
    # 2. member_id as editor
    # 3. creator_id is already seen, so skipped.
    # Total db.add calls should be 2.
    assert mock_db.add.call_count == 2


@pytest.mark.asyncio
async def test_get_board_detail_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)
    with pytest.raises(LookupError, match="board_not_found"):
        await kanban_service.get_board_detail(mock_db, User(id=uuid.uuid4()), uuid.uuid4())


@pytest.mark.asyncio
async def test_get_board_detail_success() -> None:
    board_id = uuid.uuid4()
    team_id = uuid.uuid4()
    board = KanbanBoard(
        id=board_id,
        name="Detail Board",
        team_id=team_id,
        created_by_user_id=uuid.uuid4(),
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    team = Team(id=team_id, name="Operations")
    user = User(id=uuid.uuid4())
    
    column = KanbanColumn(
        id=uuid.uuid4(),
        board_id=board_id,
        name="To Do",
        position=0,
        statuses=[],
        is_custom=True,
    )
    placement = KanbanBoardTicket(board_id=board_id, ticket_id=uuid.uuid4(), column_id=column.id, position=0)
    placement_not_found = KanbanBoardTicket(board_id=board_id, ticket_id=uuid.uuid4(), column_id=column.id, position=1)
    
    mock_placements_result = MagicMock()
    mock_placements_result.scalars.return_value.all.return_value = [placement, placement_not_found]
    
    mock_tickets_result = MagicMock()
    mock_tickets_result.scalars.return_value.all.return_value = []
    
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[mock_placements_result, mock_tickets_result])
    mock_db.get = AsyncMock(return_value=team)
    
    from star_itsm_api.schemas.ticket import TicketRead
    mock_ticket_read = TicketRead(
        id=placement.ticket_id,
        ticket_number="INC-1",
        ticket_type="incident",
        title="T1",
        description="Description with 10+ chars",
        status="new",
        priority="low",
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="owner"), \
         patch("star_itsm_api.services.kanban_service._list_board_columns", new_callable=AsyncMock, return_value=[column]), \
         patch("star_itsm_api.services.kanban_service.tickets_to_read_list", new_callable=AsyncMock, return_value=[mock_ticket_read]), \
         patch("star_itsm_api.services.kanban_service._member_reads", new_callable=AsyncMock, return_value=[]):
        
        detail = await kanban_service.get_board_detail(mock_db, user, board_id)
        assert detail.board.name == "Detail Board"
        assert detail.board.team_name == "Operations"
        assert len(detail.columns) == 1
        assert detail.columns[0].column.name == "To Do"
        assert len(detail.columns[0].cards) == 1
        assert detail.columns[0].cards[0].ticket.id == placement.ticket_id


@pytest.mark.asyncio
async def test_add_card_board_not_found() -> None:
    from star_itsm_api.schemas.kanban import KanbanCardAdd
    payload = KanbanCardAdd(column_id=uuid.uuid4(), ticket_id=uuid.uuid4())
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=None):
        with pytest.raises(LookupError, match="board_not_found"):
            await kanban_service.add_card(mock_db, User(id=uuid.uuid4()), uuid.uuid4(), payload)


@pytest.mark.asyncio
async def test_add_card_column_not_found() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    from star_itsm_api.schemas.kanban import KanbanCardAdd
    payload = KanbanCardAdd(column_id=uuid.uuid4(), ticket_id=uuid.uuid4())
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)  # column not found
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_edit_access", new_callable=AsyncMock):
        with pytest.raises(LookupError, match="column_not_found"):
            await kanban_service.add_card(mock_db, User(id=uuid.uuid4()), board.id, payload)


@pytest.mark.asyncio
async def test_add_card_with_new_ticket() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    column = KanbanColumn(
        id=uuid.uuid4(),
        board_id=board.id,
        statuses=[],
        is_custom=True,
    )
    from star_itsm_api.schemas.kanban import KanbanCardAdd
    from star_itsm_api.schemas.ticket import TicketCreate, TicketRead
    ticket_payload = TicketCreate(
        ticket_type="incident",
        title="New Ticket",
        description="Description with 10+ chars",
        priority="low",
    )
    payload = KanbanCardAdd(column_id=column.id, ticket=ticket_payload)
    
    ticket = Ticket(id=uuid.uuid4(), title="New Ticket")
    mock_read = TicketRead(
        id=ticket.id,
        ticket_number="INC-2",
        ticket_type="incident",
        title="New Ticket",
        description="Description with 10+ chars",
        status="new",
        priority="low",
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=column)
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_edit_access", new_callable=AsyncMock), \
         patch("star_itsm_api.services.kanban_service._create_ticket_for_board", new_callable=AsyncMock, return_value=ticket), \
         patch("star_itsm_api.services.kanban_service._next_card_position", new_callable=AsyncMock, return_value=1), \
         patch("star_itsm_api.services.kanban_service.tickets_to_read_list", new_callable=AsyncMock, return_value=[mock_read]):
        
        res = await kanban_service.add_card(mock_db, User(id=uuid.uuid4()), board.id, payload)
        assert res.title == "New Ticket"
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_add_card_existing_ticket_not_found() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    column = KanbanColumn(id=uuid.uuid4(), board_id=board.id)
    from star_itsm_api.schemas.kanban import KanbanCardAdd
    payload = KanbanCardAdd(column_id=column.id, ticket_id=uuid.uuid4())
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=[column, None])  # column found, ticket not found
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_edit_access", new_callable=AsyncMock):
        with pytest.raises(LookupError, match="ticket_not_found"):
            await kanban_service.add_card(mock_db, User(id=uuid.uuid4()), board.id, payload)


@pytest.mark.asyncio
async def test_add_card_existing_ticket_forbidden() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    column = KanbanColumn(id=uuid.uuid4(), board_id=board.id)
    ticket = Ticket(id=uuid.uuid4())
    from star_itsm_api.schemas.kanban import KanbanCardAdd
    payload = KanbanCardAdd(column_id=column.id, ticket_id=ticket.id)
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=[column, ticket])
    
    mock_stmt_result = MagicMock()
    mock_stmt_result.scalar_one_or_none.return_value = None  # not visible
    mock_db.execute = AsyncMock(return_value=mock_stmt_result)
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_edit_access", new_callable=AsyncMock), \
         patch("star_itsm_api.services.kanban_service.exclude_knowledge_articles"), \
         patch("star_itsm_api.services.kanban_service.apply_ticket_list_filter"):
        with pytest.raises(PermissionError, match="ticket_forbidden"):
            await kanban_service.add_card(mock_db, User(id=uuid.uuid4()), board.id, payload)


@pytest.mark.asyncio
async def test_add_card_existing_ticket_out_of_scope() -> None:
    board = KanbanBoard(id=uuid.uuid4(), team_id=uuid.uuid4())
    column = KanbanColumn(id=uuid.uuid4(), board_id=board.id)
    ticket = Ticket(id=uuid.uuid4(), assigned_team_id=uuid.uuid4())  # different team
    from star_itsm_api.schemas.kanban import KanbanCardAdd
    payload = KanbanCardAdd(column_id=column.id, ticket_id=ticket.id)
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=[column, ticket])
    
    mock_stmt_result = MagicMock()
    mock_stmt_result.scalar_one_or_none.return_value = ticket
    mock_db.execute = AsyncMock(return_value=mock_stmt_result)
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_edit_access", new_callable=AsyncMock), \
         patch("star_itsm_api.services.kanban_service.exclude_knowledge_articles"), \
         patch("star_itsm_api.services.kanban_service.apply_ticket_list_filter"):
        with pytest.raises(PermissionError, match="ticket_out_of_scope"):
            await kanban_service.add_card(mock_db, User(id=uuid.uuid4()), board.id, payload)


@pytest.mark.asyncio
async def test_add_card_existing_ticket_already_on_board() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    column = KanbanColumn(id=uuid.uuid4(), board_id=board.id)
    ticket = Ticket(id=uuid.uuid4())
    from star_itsm_api.schemas.kanban import KanbanCardAdd
    payload = KanbanCardAdd(column_id=column.id, ticket_id=ticket.id)
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=[column, ticket])
    
    mock_stmt_result = MagicMock()
    mock_stmt_result.scalar_one_or_none.return_value = ticket
    
    mock_existing_result = MagicMock()
    mock_existing_result.scalar_one_or_none.return_value = KanbanBoardTicket()  # already on board
    
    mock_db.execute = AsyncMock(side_effect=[mock_stmt_result, mock_existing_result])
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_edit_access", new_callable=AsyncMock), \
         patch("star_itsm_api.services.kanban_service.exclude_knowledge_articles"), \
         patch("star_itsm_api.services.kanban_service.apply_ticket_list_filter"):
        with pytest.raises(ValueError, match="ticket_already_on_board"):
            await kanban_service.add_card(mock_db, User(id=uuid.uuid4()), board.id, payload)


@pytest.mark.asyncio
async def test_remove_card_board_not_found() -> None:
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=None):
        with pytest.raises(LookupError, match="board_not_found"):
            await kanban_service.remove_card(mock_db, User(id=uuid.uuid4()), uuid.uuid4(), uuid.uuid4())


@pytest.mark.asyncio
async def test_remove_card_delete_ticket_forbidden() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="editor"), \
         patch("star_itsm_api.services.kanban_service.user_can_delete_tickets", return_value=False):
        
        with pytest.raises(PermissionError, match="board_forbidden"):
            await kanban_service.remove_card(mock_db, User(id=uuid.uuid4()), board.id, uuid.uuid4(), delete_ticket=True)


@pytest.mark.asyncio
async def test_remove_card_remove_card_forbidden() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="viewer"), \
         patch("star_itsm_api.services.kanban_service.user_can_remove_cards", return_value=False):
        
        with pytest.raises(PermissionError, match="board_forbidden"):
            await kanban_service.remove_card(mock_db, User(id=uuid.uuid4()), board.id, uuid.uuid4(), delete_ticket=False)


@pytest.mark.asyncio
async def test_remove_card_placement_not_found() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    mock_db = AsyncMock()
    mock_stmt_result = MagicMock()
    mock_stmt_result.scalar_one_or_none.return_value = None  # placement not found
    mock_db.execute = AsyncMock(return_value=mock_stmt_result)
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="owner"), \
         patch("star_itsm_api.services.kanban_service.user_can_remove_cards", return_value=True):
        
        with pytest.raises(LookupError, match="card_not_found"):
            await kanban_service.remove_card(mock_db, User(id=uuid.uuid4()), board.id, uuid.uuid4())


@pytest.mark.asyncio
async def test_remove_card_success_delete_ticket() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    ticket = Ticket(id=uuid.uuid4(), deleted_at=None)
    placement = KanbanBoardTicket(board_id=board.id, ticket_id=ticket.id)
    
    mock_db = AsyncMock()
    mock_stmt_result = MagicMock()
    mock_stmt_result.scalar_one_or_none.return_value = placement
    mock_db.execute = AsyncMock(return_value=mock_stmt_result)
    mock_db.get = AsyncMock(return_value=ticket)
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="owner"), \
         patch("star_itsm_api.services.kanban_service.user_can_delete_tickets", return_value=True):
        
        await kanban_service.remove_card(mock_db, User(id=uuid.uuid4()), board.id, ticket.id, delete_ticket=True)
        assert ticket.deleted_at is not None
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_move_card_board_not_found() -> None:
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=None):
        with pytest.raises(LookupError, match="board_not_found"):
            await kanban_service.move_card(mock_db, User(id=uuid.uuid4()), uuid.uuid4(), uuid.uuid4(), uuid.uuid4())


@pytest.mark.asyncio
async def test_move_card_forbidden() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="viewer"), \
         patch("star_itsm_api.services.kanban_service.user_can_move_cards", return_value=False):
        
        with pytest.raises(PermissionError, match="board_forbidden"):
            await kanban_service.move_card(mock_db, User(id=uuid.uuid4()), board.id, uuid.uuid4(), uuid.uuid4())


@pytest.mark.asyncio
async def test_move_card_column_not_found() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)  # column not found
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="owner"), \
         patch("star_itsm_api.services.kanban_service.user_can_move_cards", return_value=True):
        
        with pytest.raises(LookupError, match="column_not_found"):
            await kanban_service.move_card(mock_db, User(id=uuid.uuid4()), board.id, uuid.uuid4(), uuid.uuid4())


@pytest.mark.asyncio
async def test_move_card_placement_not_found() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    column = KanbanColumn(id=uuid.uuid4(), board_id=board.id)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=column)
    
    mock_stmt_result = MagicMock()
    mock_stmt_result.scalar_one_or_none.return_value = None  # placement not found
    mock_db.execute = AsyncMock(return_value=mock_stmt_result)
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="owner"), \
         patch("star_itsm_api.services.kanban_service.user_can_move_cards", return_value=True):
        
        with pytest.raises(LookupError, match="card_not_found"):
            await kanban_service.move_card(mock_db, User(id=uuid.uuid4()), board.id, uuid.uuid4(), column.id)


@pytest.mark.asyncio
async def test_move_card_ticket_not_found() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    column = KanbanColumn(id=uuid.uuid4(), board_id=board.id)
    placement = KanbanBoardTicket(board_id=board.id, ticket_id=uuid.uuid4(), column_id=column.id)
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=[column, None])  # column found, ticket not found
    
    mock_stmt_result = MagicMock()
    mock_stmt_result.scalar_one_or_none.return_value = placement
    mock_db.execute = AsyncMock(return_value=mock_stmt_result)
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="owner"), \
         patch("star_itsm_api.services.kanban_service.user_can_move_cards", return_value=True):
        
        with pytest.raises(LookupError, match="ticket_not_found"):
            await kanban_service.move_card(mock_db, User(id=uuid.uuid4()), board.id, placement.ticket_id, column.id)


@pytest.mark.asyncio
async def test_move_card_success_with_status_change() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    column = KanbanColumn(id=uuid.uuid4(), board_id=board.id, default_status="in_progress")
    ticket = Ticket(id=uuid.uuid4(), status="new", deleted_at=None)
    placement = KanbanBoardTicket(board_id=board.id, ticket_id=ticket.id, column_id=uuid.uuid4(), position=0)
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=[column, ticket])
    
    mock_stmt_result = MagicMock()
    mock_stmt_result.scalar_one_or_none.return_value = placement
    mock_db.execute = AsyncMock(return_value=mock_stmt_result)
    
    from star_itsm_api.schemas.ticket import TicketRead
    mock_read = TicketRead(
        id=ticket.id,
        ticket_number="INC-3",
        ticket_type="incident",
        title="T3",
        description="",
        status="in_progress",
        priority="low",
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="owner"), \
         patch("star_itsm_api.services.kanban_service.user_can_move_cards", return_value=True), \
         patch("star_itsm_api.services.kanban_service.apply_status_milestone_timestamps") as mock_ts, \
         patch("star_itsm_api.services.kanban_service.is_reopen_transition", return_value=False), \
         patch("star_itsm_api.services.kanban_service.tickets_to_read_list", new_callable=AsyncMock, return_value=[mock_read]):
        
        res = await kanban_service.move_card(mock_db, User(id=uuid.uuid4()), board.id, ticket.id, column.id, position=2)
        assert res.status == "in_progress"
        assert placement.column_id == column.id
        assert placement.position == 2
        mock_ts.assert_called_once()
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_move_card_success_reopen() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    column = KanbanColumn(id=uuid.uuid4(), board_id=board.id, default_status="assigned")
    ticket = Ticket(id=uuid.uuid4(), status="resolved", deleted_at=None)
    placement = KanbanBoardTicket(board_id=board.id, ticket_id=ticket.id, column_id=uuid.uuid4(), position=0)
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=[column, ticket])
    
    mock_stmt_result = MagicMock()
    mock_stmt_result.scalar_one_or_none.return_value = placement
    mock_db.execute = AsyncMock(return_value=mock_stmt_result)
    
    from star_itsm_api.schemas.ticket import TicketRead
    mock_read = TicketRead(
        id=ticket.id,
        ticket_number="INC-3",
        ticket_type="incident",
        title="T3",
        description="",
        status="assigned",
        priority="low",
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock, return_value=({}, [])), \
         patch("star_itsm_api.services.kanban_service.resolve_member_role", return_value="owner"), \
         patch("star_itsm_api.services.kanban_service.user_can_move_cards", return_value=True), \
         patch("star_itsm_api.services.kanban_service.apply_status_milestone_timestamps"), \
         patch("star_itsm_api.services.kanban_service.is_reopen_transition", return_value=True), \
         patch("star_itsm_api.services.kanban_service.tickets_to_read_list", new_callable=AsyncMock, return_value=[mock_read]):
        
        res = await kanban_service.move_card(mock_db, User(id=uuid.uuid4()), board.id, ticket.id, column.id, position=None)
        assert res.status == "assigned"
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_column_board_not_found() -> None:
    from star_itsm_api.schemas.kanban import KanbanColumnCreate
    payload = KanbanColumnCreate(name="New Col", position=None, default_status=None, wip_limit=None)
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=None):
        with pytest.raises(LookupError, match="board_not_found"):
            await kanban_service.create_column(mock_db, User(id=uuid.uuid4()), uuid.uuid4(), payload)


@pytest.mark.asyncio
async def test_create_column_success() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    from star_itsm_api.schemas.kanban import KanbanColumnCreate
    payload = KanbanColumnCreate(name="New Col", position=1, default_status="new", wip_limit=5)
    
    col1 = KanbanColumn(id=uuid.uuid4(), board_id=board.id, position=0)
    col2 = KanbanColumn(id=uuid.uuid4(), board_id=board.id, position=1)
    
    mock_db = AsyncMock()
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_edit_access", new_callable=AsyncMock), \
         patch("star_itsm_api.services.kanban_service._list_board_columns", new_callable=AsyncMock, return_value=[col1, col2]):
        
        res = await kanban_service.create_column(mock_db, User(id=uuid.uuid4()), board.id, payload)
        assert res.name == "New Col"
        assert res.position == 1
        assert res.default_status == "new"
        assert res.wip_limit == 5
        assert col2.position == 2  # shifted
        assert col1.position == 0  # not shifted
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_column_success_position_none() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    from star_itsm_api.schemas.kanban import KanbanColumnCreate
    payload = KanbanColumnCreate(name="New Col None", position=None, default_status="new", wip_limit=5)
    
    col1 = KanbanColumn(id=uuid.uuid4(), board_id=board.id, position=0)
    
    mock_db = AsyncMock()
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_edit_access", new_callable=AsyncMock), \
         patch("star_itsm_api.services.kanban_service._list_board_columns", new_callable=AsyncMock, return_value=[col1]):
        
        res = await kanban_service.create_column(mock_db, User(id=uuid.uuid4()), board.id, payload)
        assert res.name == "New Col None"
        assert res.position == 1  # len(columns)
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_column_board_not_found() -> None:
    from star_itsm_api.schemas.kanban import KanbanColumnUpdate
    payload = KanbanColumnUpdate()
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=None):
        with pytest.raises(LookupError, match="board_not_found"):
            await kanban_service.update_column(mock_db, User(id=uuid.uuid4()), uuid.uuid4(), uuid.uuid4(), payload)


@pytest.mark.asyncio
async def test_update_column_not_found() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    from star_itsm_api.schemas.kanban import KanbanColumnUpdate
    payload = KanbanColumnUpdate()
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_edit_access", new_callable=AsyncMock):
        with pytest.raises(LookupError, match="column_not_found"):
            await kanban_service.update_column(mock_db, User(id=uuid.uuid4()), board.id, uuid.uuid4(), payload)


@pytest.mark.asyncio
async def test_update_column_success_shift_right() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    column = KanbanColumn(id=uuid.uuid4(), board_id=board.id, position=0, name="Col 0", statuses=[], is_custom=True)
    col1 = KanbanColumn(id=uuid.uuid4(), board_id=board.id, position=1, name="Col 1", statuses=[], is_custom=True)
    col2 = KanbanColumn(id=uuid.uuid4(), board_id=board.id, position=2, name="Col 2", statuses=[], is_custom=True)
    
    from star_itsm_api.schemas.kanban import KanbanColumnUpdate
    payload = KanbanColumnUpdate(position=2, name="New Name Col 0", wip_limit=10, default_status="assigned")
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=column)
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_edit_access", new_callable=AsyncMock), \
         patch("star_itsm_api.services.kanban_service._list_board_columns", new_callable=AsyncMock, return_value=[column, col1, col2]):
        
        res = await kanban_service.update_column(mock_db, User(id=uuid.uuid4()), board.id, column.id, payload)
        assert res.name == "New Name Col 0"
        assert column.position == 2
        assert col1.position == 0  # shifted left
        assert col2.position == 1  # shifted left
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_column_success_shift_left() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    col0 = KanbanColumn(id=uuid.uuid4(), board_id=board.id, position=0, name="Col 0", statuses=[], is_custom=True)
    col1 = KanbanColumn(id=uuid.uuid4(), board_id=board.id, position=1, name="Col 1", statuses=[], is_custom=True)
    column = KanbanColumn(id=uuid.uuid4(), board_id=board.id, position=2, name="Col 2", statuses=[], is_custom=True)
    
    from star_itsm_api.schemas.kanban import KanbanColumnUpdate
    payload = KanbanColumnUpdate(position=0)
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=column)
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_edit_access", new_callable=AsyncMock), \
         patch("star_itsm_api.services.kanban_service._list_board_columns", new_callable=AsyncMock, return_value=[col0, col1, column]):
        
        await kanban_service.update_column(mock_db, User(id=uuid.uuid4()), board.id, column.id, payload)
        assert column.position == 0
        assert col0.position == 1  # shifted right
        assert col1.position == 2  # shifted right
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_column_board_not_found() -> None:
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=None):
        with pytest.raises(LookupError, match="board_not_found"):
            await kanban_service.delete_column(mock_db, User(id=uuid.uuid4()), uuid.uuid4(), uuid.uuid4())


@pytest.mark.asyncio
async def test_delete_column_not_found() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_edit_access", new_callable=AsyncMock):
        with pytest.raises(LookupError, match="column_not_found"):
            await kanban_service.delete_column(mock_db, User(id=uuid.uuid4()), board.id, uuid.uuid4())


@pytest.mark.asyncio
async def test_delete_column_not_empty() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    column = KanbanColumn(id=uuid.uuid4(), board_id=board.id)
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=column)
    
    mock_count_result = MagicMock()
    mock_count_result.scalar_one.return_value = 3  # not empty
    mock_db.execute = AsyncMock(return_value=mock_count_result)
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_edit_access", new_callable=AsyncMock):
        with pytest.raises(ValueError, match="column_not_empty"):
            await kanban_service.delete_column(mock_db, User(id=uuid.uuid4()), board.id, column.id)


@pytest.mark.asyncio
async def test_delete_column_success() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    column = KanbanColumn(id=uuid.uuid4(), board_id=board.id, position=1)
    col_higher = KanbanColumn(id=uuid.uuid4(), board_id=board.id, position=2)
    
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=column)
    
    mock_count_result = MagicMock()
    mock_count_result.scalar_one.return_value = 0  # empty
    
    mock_remaining_result = MagicMock()
    mock_remaining_result.scalars.return_value.all.return_value = [col_higher]
    
    mock_db.execute = AsyncMock(side_effect=[mock_count_result, mock_remaining_result])
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_edit_access", new_callable=AsyncMock):
        
        await kanban_service.delete_column(mock_db, User(id=uuid.uuid4()), board.id, column.id)
        assert col_higher.position == 1  # shifted down
        mock_db.delete.assert_called_once_with(column)
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_search_tickets_for_board_not_found() -> None:
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=None):
        with pytest.raises(LookupError, match="board_not_found"):
            await kanban_service.search_tickets_for_board(mock_db, User(id=uuid.uuid4()), uuid.uuid4(), "query")


@pytest.mark.asyncio
async def test_search_tickets_for_board_short_query() -> None:
    board = KanbanBoard(id=uuid.uuid4())
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock):
        res = await kanban_service.search_tickets_for_board(mock_db, User(id=uuid.uuid4()), board.id, "a")
        assert res == []


@pytest.mark.asyncio
async def test_search_tickets_for_board_success() -> None:
    board_id = uuid.uuid4()
    team_id = uuid.uuid4()
    board = KanbanBoard(id=board_id, team_id=team_id)
    user = User(id=uuid.uuid4())
    
    ticket = Ticket(id=uuid.uuid4(), ticket_number="INC-10", title="Search Match")
    
    mock_on_board_result = MagicMock()
    mock_on_board_result.scalars.return_value.all.return_value = [uuid.uuid4()]  # some other ticket on board
    
    mock_tickets_result = MagicMock()
    mock_tickets_result.scalars.return_value.all.return_value = [ticket]
    
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[mock_on_board_result, mock_tickets_result])
    
    from star_itsm_api.schemas.ticket import TicketRead
    mock_read = TicketRead(
        id=ticket.id,
        ticket_number="INC-10",
        ticket_type="incident",
        title="Search Match",
        description="",
        status="new",
        priority="low",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        assigned_team_name="Operations",
        assigned_user_name="Bob"
    )
    
    with patch("star_itsm_api.services.kanban_service.get_board_row", new_callable=AsyncMock, return_value=board), \
         patch("star_itsm_api.services.kanban_service._require_board_access", new_callable=AsyncMock), \
         patch("star_itsm_api.services.kanban_service.exclude_knowledge_articles"), \
         patch("star_itsm_api.services.kanban_service.apply_ticket_list_filter"), \
         patch("star_itsm_api.services.kanban_service.tickets_to_read_list", new_callable=AsyncMock, return_value=[mock_read]):
        
        res = await kanban_service.search_tickets_for_board(mock_db, user, board_id, "Match")
        assert len(res) == 1
        assert res[0].ticket_number == "INC-10"
        assert res[0].title == "Search Match"
        assert res[0].assigned_team_name == "Operations"
        assert res[0].assigned_user_name == "Bob"







