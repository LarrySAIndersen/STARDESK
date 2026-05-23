import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import require_staff
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.kanban import (
    KanbanBoardCreate,
    KanbanBoardDetailRead,
    KanbanBoardSummaryRead,
    KanbanBoardUpdate,
    KanbanCardMove,
)
from star_itsm_api.schemas.ticket import TicketRead
from star_itsm_api.services import kanban_service

router = APIRouter(prefix="/kanban", tags=["kanban"])


@router.get("/boards", response_model=list[KanbanBoardSummaryRead])
async def list_boards(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> list[KanbanBoardSummaryRead]:
    return await kanban_service.list_boards(db, current_user)


@router.post("/boards", response_model=KanbanBoardSummaryRead, status_code=201)
async def create_board(
    payload: KanbanBoardCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> KanbanBoardSummaryRead:
    return await kanban_service.create_board(db, current_user, payload)


@router.get("/boards/{board_id}", response_model=KanbanBoardDetailRead)
async def get_board(
    board_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> KanbanBoardDetailRead:
    try:
        return await kanban_service.get_board_detail(db, current_user, board_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Board not found") from None
    except PermissionError:
        raise HTTPException(status_code=403, detail="Insufficient permissions") from None


@router.patch("/boards/{board_id}", response_model=KanbanBoardSummaryRead)
async def update_board(
    board_id: uuid.UUID,
    payload: KanbanBoardUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> KanbanBoardSummaryRead:
    try:
        return await kanban_service.update_board(db, current_user, board_id, payload)
    except LookupError:
        raise HTTPException(status_code=404, detail="Board not found") from None
    except PermissionError:
        raise HTTPException(status_code=403, detail="Insufficient permissions") from None


@router.patch("/boards/{board_id}/cards/{ticket_id}/move", response_model=TicketRead)
async def move_card(
    board_id: uuid.UUID,
    ticket_id: uuid.UUID,
    payload: KanbanCardMove,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketRead:
    try:
        return await kanban_service.move_card(
            db,
            current_user,
            board_id,
            ticket_id,
            payload.column_id,
        )
    except LookupError as exc:
        detail = "Not found"
        if str(exc) == "column_not_found":
            detail = "Column not found"
        elif str(exc) == "ticket_not_found":
            detail = "Ticket not found"
        raise HTTPException(status_code=404, detail=detail) from None
    except PermissionError as exc:
        if str(exc) == "ticket_out_of_scope":
            raise HTTPException(
                status_code=400,
                detail="Ticket is not in this board scope",
            ) from None
        raise HTTPException(status_code=403, detail="Insufficient permissions") from None
