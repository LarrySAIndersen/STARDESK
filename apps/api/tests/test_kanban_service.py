import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.models.kanban import KanbanColumn, KanbanBoard, KanbanBoardMember, KanbanBoardTicket
from star_itsm_api.models.user import User
from star_itsm_api.models.team import Team
from star_itsm_api.models.ticket import Ticket
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
