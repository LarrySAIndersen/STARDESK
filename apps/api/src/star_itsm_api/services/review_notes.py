import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.page_review_note import NOTE_STATUSES, PageReviewNote
from star_itsm_api.models.user import User
from star_itsm_api.schemas.review_note import ReviewNoteCreate, ReviewNoteRead, ReviewNoteUpdate


def _now() -> datetime:
    return datetime.now(UTC)


def _to_read(
    row: PageReviewNote,
    *,
    author_name: str,
    author_email: str | None = None,
) -> ReviewNoteRead:
    return ReviewNoteRead(
        id=row.id,
        page_path=row.page_path,
        page_title=row.page_title,
        comment=row.comment,
        position_x=row.position_x,
        position_y=row.position_y,
        position_selector=row.position_selector,
        created_by_user_id=row.created_by_user_id,
        created_by_name=author_name,
        created_by_email=author_email,
        status=row.status,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _author_profiles(
    db: AsyncSession,
    user_ids: set[uuid.UUID],
) -> dict[uuid.UUID, tuple[str, str]]:
    if not user_ids:
        return {}
    result = await db.execute(
        select(User.id, User.display_name, User.email).where(User.id.in_(user_ids))
    )
    return {row.id: (row.display_name, row.email) for row in result.all()}


async def list_review_notes(
    db: AsyncSession,
    *,
    page_path: str | None = None,
    status: str | None = None,
) -> list[ReviewNoteRead]:
    query = select(PageReviewNote).order_by(PageReviewNote.created_at.desc())
    if page_path:
        query = query.where(PageReviewNote.page_path == page_path)
    if status:
        query = query.where(PageReviewNote.status == status)
    result = await db.execute(query)
    rows = list(result.scalars().all())
    profiles = await _author_profiles(db, {row.created_by_user_id for row in rows})
    return [
        _to_read(
            row,
            author_name=profiles.get(row.created_by_user_id, ("Ukendt", ""))[0],
            author_email=profiles.get(row.created_by_user_id, ("", None))[1],
        )
        for row in rows
    ]


async def create_review_note(
    db: AsyncSession,
    *,
    payload: ReviewNoteCreate,
    author: User,
) -> ReviewNoteRead:
    now = _now()
    row = PageReviewNote(
        id=uuid.uuid4(),
        page_path=payload.page_path.strip(),
        page_title=payload.page_title.strip(),
        comment=payload.comment.strip(),
        position_x=payload.position_x,
        position_y=payload.position_y,
        position_selector=payload.position_selector,
        created_by_user_id=author.id,
        status="open",
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _to_read(row, author_name=author.display_name, author_email=author.email)


async def update_review_note(
    db: AsyncSession,
    *,
    note_id: uuid.UUID,
    payload: ReviewNoteUpdate,
) -> ReviewNoteRead:
    if payload.status not in NOTE_STATUSES:
        raise ValueError(f"Invalid status: {payload.status}")
    row = await db.get(PageReviewNote, note_id)
    if row is None:
        raise LookupError("Note not found")
    row.status = payload.status
    row.updated_at = _now()
    await db.commit()
    await db.refresh(row)
    profiles = await _author_profiles(db, {row.created_by_user_id})
    name, email = profiles.get(row.created_by_user_id, ("Ukendt", None))
    return _to_read(row, author_name=name, author_email=email)
