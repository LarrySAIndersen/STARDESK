import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.http_details import NOT_FOUND, TICKET_NOT_FOUND
from star_itsm_api.core.security import get_current_user
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.personal import (
    PersonalKanbanAddCard,
    PersonalKanbanCardRead,
    PersonalKanbanColumnUpdate,
    PersonalKanbanRead,
    PersonalNoteCreate,
    PersonalNoteRead,
    PersonalNoteUpdate,
    TicketPostItSummary,
)
from star_itsm_api.services import personal_service

router = APIRouter(prefix="/personal", tags=["personal"])


@router.get("/notes")
async def list_notes(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> list[PersonalNoteRead]:
    return await personal_service.list_notes(db, current_user)


@router.post("/notes", status_code=status.HTTP_201_CREATED)
async def create_note(
    payload: PersonalNoteCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> PersonalNoteRead:
    return await personal_service.create_note(db, current_user, payload)


@router.patch("/notes/{note_id}")
async def update_note(
    note_id: uuid.UUID,
    payload: PersonalNoteUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> PersonalNoteRead:
    try:
        return await personal_service.update_note(db, current_user, note_id, payload)
    except LookupError:
        raise HTTPException(status_code=404, detail=NOT_FOUND) from None
    except PermissionError:
        raise HTTPException(
            status_code=403,
            detail="Only staff can share post-its with the team",
        ) from None


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> None:
    try:
        await personal_service.delete_note(db, current_user, note_id)
    except LookupError:
        raise HTTPException(status_code=404, detail=NOT_FOUND) from None


@router.get("/tickets/{ticket_id}/post-its")
async def list_ticket_post_its(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> list[PersonalNoteRead]:
    try:
        return await personal_service.list_ticket_post_its(db, current_user, ticket_id)
    except LookupError:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND) from None


@router.get("/ticket-post-its/summary")
async def summarize_ticket_post_its(
    ticket_ids: str = Query(..., min_length=36),
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> list[TicketPostItSummary]:
    ids: list[uuid.UUID] = []
    for part in ticket_ids.split(","):
        trimmed = part.strip()
        if trimmed:
            ids.append(uuid.UUID(trimmed))
    return await personal_service.summarize_ticket_post_its(db, current_user, ids)


@router.get("/kanban")
async def get_kanban(
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> PersonalKanbanRead:
    return await personal_service.get_personal_kanban(db, current_user)


@router.post("/kanban/cards", status_code=status.HTTP_201_CREATED)
async def add_kanban_card(
    payload: PersonalKanbanAddCard,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> PersonalKanbanCardRead:
    try:
        return await personal_service.add_kanban_card(
            db,
            current_user,
            payload.ticket_id,
            column_name=payload.column_name,
        )
    except LookupError:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND) from None
    except ValueError as exc:
        if str(exc) == "ticket_already_on_board":
            raise HTTPException(status_code=409, detail="Ticket is already on your board") from None
        if str(exc) == "invalid_column":
            raise HTTPException(status_code=400, detail="Invalid column name") from None
        raise HTTPException(status_code=400, detail=str(exc)) from None


@router.patch("/kanban/cards/{ticket_id}")
async def move_kanban_card(
    ticket_id: uuid.UUID,
    payload: PersonalKanbanColumnUpdate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> PersonalKanbanCardRead:
    try:
        return await personal_service.move_kanban_card(db, current_user, ticket_id, payload)
    except LookupError:
        raise HTTPException(status_code=404, detail=NOT_FOUND) from None
    except ValueError as exc:
        if str(exc) == "invalid_column":
            raise HTTPException(status_code=400, detail="Invalid column name") from None
        raise HTTPException(status_code=400, detail=str(exc)) from None


@router.delete("/kanban/cards/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_kanban_card(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(get_current_user),
) -> None:
    try:
        await personal_service.remove_kanban_card(db, current_user, ticket_id)
    except LookupError:
        raise HTTPException(status_code=404, detail=NOT_FOUND) from None
