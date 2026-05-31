import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import (
    get_current_user,
    require_staff,
)
from star_itsm_api.deps import require_db
from star_itsm_api.models.user import User
from star_itsm_api.schemas.review_note import ReviewNoteCreate, ReviewNoteRead, ReviewNoteUpdate
from star_itsm_api.services.permissions import is_staff_role, is_stardesk_reviewer
from star_itsm_api.services import review_notes

router = APIRouter(prefix="/review-notes", tags=["review-notes"])


def _can_view_notes(user: User) -> bool:
    return is_staff_role(user) or is_stardesk_reviewer(user)


async def require_note_viewer(user: User = Depends(get_current_user)) -> User:
    if not _can_view_notes(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return user


async def require_reviewer(user: User = Depends(get_current_user)) -> User:
    if not is_stardesk_reviewer(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return user


@router.get("")
async def list_review_notes(
    page_path: str | None = Query(default=None),
    status: str | None = Query(default=None, pattern=r"^(open|resolved)$"),
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(require_note_viewer),
) -> list[ReviewNoteRead]:
    return await review_notes.list_review_notes(db, page_path=page_path, status=status)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_review_note(
    payload: ReviewNoteCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_reviewer),
) -> ReviewNoteRead:
    return await review_notes.create_review_note(db, payload=payload, author=current_user)


@router.patch("/{note_id}")
async def update_review_note(
    note_id: uuid.UUID,
    payload: ReviewNoteUpdate,
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(require_staff()),
) -> ReviewNoteRead:
    try:
        return await review_notes.update_review_note(db, note_id=note_id, payload=payload)
    except LookupError:
        raise HTTPException(status_code=404, detail="Seddel ikke fundet") from None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
