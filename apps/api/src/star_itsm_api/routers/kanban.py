import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.http_details import (
    BOARD_NOT_FOUND,
    COLUMN_NOT_FOUND,
    INSUFFICIENT_PERMISSIONS,
    NOT_FOUND,
    TICKET_NOT_FOUND,
)
from star_itsm_api.core.security import require_staff
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.kanban import (
    KanbanBoardCreate,
    KanbanBoardDetailRead,
    KanbanBoardSummaryRead,
    KanbanBoardUpdate,
    KanbanCardAdd,
    KanbanCardMove,
    KanbanColumnCreate,
    KanbanColumnRead,
    KanbanColumnUpdate,
    KanbanTicketSearchResult,
)
from star_itsm_api.schemas.ticket import TicketRead
from star_itsm_api.services import kanban_service

router = APIRouter(prefix="/kanban", tags=["kanban"])


@router.get("/boards")
async def list_boards(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> list[KanbanBoardSummaryRead]:
    return await kanban_service.list_boards(db, current_user)


@router.post("/boards", status_code=201)
async def create_board(
    payload: KanbanBoardCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> KanbanBoardSummaryRead:
    return await kanban_service.create_board(db, current_user, payload)


@router.get("/boards/{board_id}")
async def get_board(
    board_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> KanbanBoardDetailRead:
    try:
        return await kanban_service.get_board_detail(db, current_user, board_id)
    except LookupError:
        raise HTTPException(status_code=404, detail=BOARD_NOT_FOUND) from None
    except PermissionError:
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS) from None


@router.patch("/boards/{board_id}")
async def update_board(
    board_id: uuid.UUID,
    payload: KanbanBoardUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> KanbanBoardSummaryRead:
    try:
        return await kanban_service.update_board(db, current_user, board_id, payload)
    except LookupError:
        raise HTTPException(status_code=404, detail=BOARD_NOT_FOUND) from None
    except PermissionError:
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS) from None


@router.delete("/boards/{board_id}", status_code=204)
async def delete_board(
    board_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> None:
    try:
        await kanban_service.delete_board(db, current_user, board_id)
    except LookupError:
        raise HTTPException(status_code=404, detail=BOARD_NOT_FOUND) from None
    except PermissionError:
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS) from None


@router.post("/boards/{board_id}/cards", status_code=201)
async def add_card(
    board_id: uuid.UUID,
    payload: KanbanCardAdd,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> TicketRead:
    try:
        return await kanban_service.add_card(db, current_user, board_id, payload)
    except LookupError as exc:
        detail = NOT_FOUND
        if str(exc) == "column_not_found":
            detail = COLUMN_NOT_FOUND
        elif str(exc) == "ticket_not_found":
            detail = TICKET_NOT_FOUND
        raise HTTPException(status_code=404, detail=detail) from None
    except PermissionError as exc:
        if str(exc) == "ticket_out_of_scope":
            raise HTTPException(
                status_code=400,
                detail="Ticket is not in this board scope",
            ) from None
        if str(exc) == "ticket_forbidden":
            raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS) from None
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS) from None
    except ValueError as exc:
        if str(exc) == "ticket_already_on_board":
            raise HTTPException(status_code=409, detail="Ticket is already on this board") from None
        raise HTTPException(status_code=400, detail=str(exc)) from None


@router.delete("/boards/{board_id}/cards/{ticket_id}", status_code=204)
async def remove_card(
    board_id: uuid.UUID,
    ticket_id: uuid.UUID,
    delete_ticket: bool = Query(default=False),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> None:
    try:
        await kanban_service.remove_card(
            db,
            current_user,
            board_id,
            ticket_id,
            delete_ticket=delete_ticket,
        )
    except LookupError as exc:
        detail = NOT_FOUND
        if str(exc) == "card_not_found":
            detail = "Card not found on board"
        raise HTTPException(status_code=404, detail=detail) from None
    except PermissionError:
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS) from None


@router.patch("/boards/{board_id}/cards/{ticket_id}/move")
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
            payload.position,
        )
    except LookupError as exc:
        detail = NOT_FOUND
        if str(exc) == "column_not_found":
            detail = COLUMN_NOT_FOUND
        elif str(exc) == "ticket_not_found":
            detail = TICKET_NOT_FOUND
        elif str(exc) == "card_not_found":
            detail = "Card not found on board"
        raise HTTPException(status_code=404, detail=detail) from None
    except PermissionError:
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS) from None


@router.post("/boards/{board_id}/columns", status_code=201)
async def create_column(
    board_id: uuid.UUID,
    payload: KanbanColumnCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> KanbanColumnRead:
    try:
        return await kanban_service.create_column(db, current_user, board_id, payload)
    except LookupError:
        raise HTTPException(status_code=404, detail=BOARD_NOT_FOUND) from None
    except PermissionError:
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS) from None


@router.patch("/boards/{board_id}/columns/{column_id}")
async def update_column(
    board_id: uuid.UUID,
    column_id: uuid.UUID,
    payload: KanbanColumnUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> KanbanColumnRead:
    try:
        return await kanban_service.update_column(db, current_user, board_id, column_id, payload)
    except LookupError as exc:
        detail = NOT_FOUND
        if str(exc) == "column_not_found":
            detail = COLUMN_NOT_FOUND
        raise HTTPException(status_code=404, detail=detail) from None
    except PermissionError:
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS) from None


@router.delete("/boards/{board_id}/columns/{column_id}", status_code=204)
async def delete_column(
    board_id: uuid.UUID,
    column_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> None:
    try:
        await kanban_service.delete_column(db, current_user, board_id, column_id)
    except LookupError as exc:
        detail = NOT_FOUND
        if str(exc) == "column_not_found":
            detail = COLUMN_NOT_FOUND
        raise HTTPException(status_code=404, detail=detail) from None
    except PermissionError:
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS) from None
    except ValueError as exc:
        if str(exc) == "column_not_empty":
            raise HTTPException(
                status_code=400,
                detail="Column must be empty before deletion",
            ) from None
        raise HTTPException(status_code=400, detail=str(exc)) from None


@router.get("/boards/{board_id}/ticket-search")
async def search_tickets(
    board_id: uuid.UUID,
    q: str = Query(min_length=0, max_length=128),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_staff()),
) -> list[KanbanTicketSearchResult]:
    try:
        return await kanban_service.search_tickets_for_board(db, current_user, board_id, q)
    except LookupError:
        raise HTTPException(status_code=404, detail=BOARD_NOT_FOUND) from None
    except PermissionError:
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS) from None
