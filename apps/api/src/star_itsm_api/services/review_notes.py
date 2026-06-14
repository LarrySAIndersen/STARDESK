import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse, RedirectResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.page_review_note import NOTE_STATUSES, PageReviewNote
from star_itsm_api.models.user import User
from star_itsm_api.schemas.review_note import (
    ReviewNoteCreate,
    ReviewNoteRead,
    ReviewNoteUpdate,
    decode_review_note_screenshot,
)
from star_itsm_api.services import file_storage


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
        has_screenshot=bool(row.screenshot_storage_key),
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


async def _persist_screenshot(*, note_id: uuid.UUID, content: bytes) -> str:
    pathname = f"review-notes/{note_id}/screenshot.png"
    if file_storage.blob_storage_enabled():
        return await file_storage.persist_to_blob(
            pathname=pathname,
            content=content,
            content_type="image/png",
        )
    path = file_storage.persist_to_local_disk(
        ticket_id="review-notes",
        attachment_id=str(note_id),
        filename="screenshot.png",
        content=content,
    )
    return str(path)


async def build_screenshot_download_response(
    storage_key: str,
) -> FileResponse | RedirectResponse | Response:
    if file_storage.is_blob_storage_key(storage_key):
        public_url = file_storage.public_blob_download_url(storage_key)
        if public_url:
            return RedirectResponse(url=public_url, status_code=307)
        body = await file_storage.read_blob_bytes(storage_key)
        return Response(
            content=body,
            media_type="image/png",
            headers={"Content-Disposition": 'inline; filename="screenshot.png"'},
        )

    if file_storage.is_vercel_serverless():
        raise HTTPException(
            status_code=404,
            detail=file_storage.FILE_NOT_FOUND_DETAIL_DA,
        )

    path = Path(storage_key)
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail=file_storage.FILE_NOT_FOUND_DETAIL_DA,
        )
    return FileResponse(
        path,
        media_type="image/png",
        filename="screenshot.png",
        content_disposition_type="inline",
    )


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
    note_id = uuid.uuid4()
    screenshot_bytes = decode_review_note_screenshot(payload.screenshot_base64)
    screenshot_storage_key: str | None = None
    if screenshot_bytes is not None:
        screenshot_storage_key = await _persist_screenshot(
            note_id=note_id,
            content=screenshot_bytes,
        )

    row = PageReviewNote(
        id=note_id,
        page_path=payload.page_path.strip(),
        page_title=payload.page_title.strip(),
        comment=payload.comment.strip(),
        position_x=payload.position_x,
        position_y=payload.position_y,
        position_selector=payload.position_selector,
        screenshot_storage_key=screenshot_storage_key,
        created_by_user_id=author.id,
        status="open",
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _to_read(row, author_name=author.display_name, author_email=author.email)


async def get_review_note_screenshot(
    db: AsyncSession,
    *,
    note_id: uuid.UUID,
) -> FileResponse | RedirectResponse | Response:
    row = await db.get(PageReviewNote, note_id)
    if row is None or not row.screenshot_storage_key:
        raise LookupError("Screenshot not found")
    return await build_screenshot_download_response(row.screenshot_storage_key)


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


async def delete_review_note(
    db: AsyncSession,
    *,
    note_id: uuid.UUID,
) -> None:
    row = await db.get(PageReviewNote, note_id)
    if row is None:
        raise LookupError("Note not found")
    row.status = "deleted"
    row.updated_at = _now()
    await db.commit()
