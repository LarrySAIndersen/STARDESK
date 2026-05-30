import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse, RedirectResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import ROLE_ADMIN, ROLE_SUBMITTER, ROLE_TOP_ADMIN, is_staff
from star_itsm_api.models.attachment import Attachment
from star_itsm_api.models.user import User
from star_itsm_api.schemas.attachment import AttachmentRead
from star_itsm_api.services.db_resilience import rollback_session
from star_itsm_api.services import file_storage
from star_itsm_api.services.virus_scan import run_virus_scan

logger = logging.getLogger(__name__)

SCAN_LABELS_DA = {
    "pending": "Afventer virusscan",
    "scanning": "Scanner…",
    "clean": "Godkendt",
    "infected": "Blokeret",
    "failed": "Scan fejlede",
}

ALLOWED_CONTENT_TYPES = frozenset(
    {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def can_delete_attachment(user: User, attachment: Attachment) -> bool:
    """Uploader or administrator (admin / top_admin) may remove an attachment."""
    if user.role in (ROLE_ADMIN, ROLE_TOP_ADMIN):
        return True
    return user.id == attachment.uploader_user_id


def upload_root() -> Path:
    from star_itsm_api.core.config import settings

    root = Path(settings.upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def attachment_to_read(row: Attachment, *, user: User) -> AttachmentRead:
    can_download = row.scan_status == "clean" and (
        is_staff(user) or (user.role == ROLE_SUBMITTER and row.visible_to_submitter)
    )
    file_retrievable = file_storage.storage_key_is_retrievable(row.storage_key)
    file_unavailable_label_da = (
        None
        if file_retrievable
        else file_storage.FILE_UNAVAILABLE_LABEL_DA
    )
    return AttachmentRead(
        id=row.id,
        filename=row.filename,
        content_type=row.content_type,
        size_bytes=row.size_bytes,
        scan_status=row.scan_status,
        scan_status_label_da=SCAN_LABELS_DA.get(row.scan_status, row.scan_status),
        scanned_at=row.scanned_at,
        created_at=row.created_at,
        download_available=can_download and file_retrievable,
        file_retrievable=file_retrievable,
        file_unavailable_label_da=file_unavailable_label_da,
        can_delete=can_delete_attachment(user, row),
    )


async def list_ticket_attachments_for_detail(
    db: AsyncSession,
    ticket_id: uuid.UUID,
    user: User,
    *,
    reporter_user_id: uuid.UUID,
) -> list[AttachmentRead]:
    """Staff see all attachments; reporter sees own uploads (no download until staff policy)."""
    if not is_staff(user) and user.id != reporter_user_id:
        return []

    try:
        return await _list_ticket_attachments_for_detail(
            db,
            ticket_id=ticket_id,
            user=user,
            reporter_user_id=reporter_user_id,
        )
    except Exception:
        logger.warning(
            "Could not load attachments for ticket %s; returning empty list",
            ticket_id,
            exc_info=True,
        )
        await rollback_session(db)
        return []


async def _list_ticket_attachments_for_detail(
    db: AsyncSession,
    *,
    ticket_id: uuid.UUID,
    user: User,
    reporter_user_id: uuid.UUID,
) -> list[AttachmentRead]:
    result = await db.execute(
        select(Attachment)
        .where(Attachment.ticket_id == ticket_id)
        .order_by(Attachment.created_at.asc())
    )
    rows = list(result.scalars().all())
    if is_staff(user):
        return [attachment_to_read(row, user=user) for row in rows]
    return [
        AttachmentRead(
            id=row.id,
            filename=row.filename,
            content_type=row.content_type,
            size_bytes=row.size_bytes,
            scan_status=row.scan_status,
            scan_status_label_da=SCAN_LABELS_DA.get(row.scan_status, row.scan_status),
            scanned_at=row.scanned_at,
            created_at=row.created_at,
            download_available=False,
            file_retrievable=file_storage.storage_key_is_retrievable(row.storage_key),
            file_unavailable_label_da=(
                None
                if file_storage.storage_key_is_retrievable(row.storage_key)
                else file_storage.FILE_UNAVAILABLE_LABEL_DA
            ),
            can_delete=can_delete_attachment(user, row),
        )
        for row in rows
    ]


async def delete_ticket_attachment(
    db: AsyncSession,
    *,
    ticket_id: uuid.UUID,
    attachment_id: uuid.UUID,
    user: User,
) -> AttachmentRead:
    attachment = await db.get(Attachment, attachment_id)
    if attachment is None or attachment.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if not can_delete_attachment(user, attachment):
        raise HTTPException(
            status_code=403,
            detail="Du har ikke tilladelse til at fjerne denne vedhæftning",
        )
    read = attachment_to_read(attachment, user=user)
    await db.delete(attachment)
    await db.flush()
    return read


async def save_ticket_upload(
    db: AsyncSession,
    *,
    ticket_id: uuid.UUID,
    user: User,
    upload: UploadFile,
) -> AttachmentRead:
    file_storage.require_attachment_storage_configured()

    if upload.filename is None or not upload.filename.strip():
        raise HTTPException(status_code=400, detail="Filename is required")

    content = await upload.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File exceeds 10 MB limit")

    content_type = upload.content_type or "application/octet-stream"
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="File type not allowed")

    attachment_id = uuid.uuid4()
    safe_name = Path(upload.filename).name
    ticket_id_str = str(ticket_id)
    attachment_id_str = str(attachment_id)

    scan_path = file_storage.write_temp_upload(content, suffix=safe_name)
    storage_key: str

    try:
        if file_storage.blob_storage_enabled():
            pathname = file_storage.attachment_pathname(
                ticket_id=ticket_id_str,
                attachment_id=attachment_id_str,
                filename=safe_name,
            )
            storage_key = await file_storage.persist_to_blob(
                pathname=pathname,
                content=content,
                content_type=content_type,
            )
        else:
            storage_path = file_storage.persist_to_local_disk(
                ticket_id=ticket_id_str,
                attachment_id=attachment_id_str,
                filename=safe_name,
                content=content,
            )
            storage_key = str(storage_path)

        now = datetime.now(UTC)
        row = Attachment(
            id=attachment_id,
            ticket_id=ticket_id,
            comment_id=None,
            uploader_user_id=user.id,
            filename=safe_name,
            content_type=content_type,
            size_bytes=len(content),
            storage_key=storage_key,
            scan_status="pending",
            scanned_at=None,
            scan_detail=None,
            visible_to_submitter=False,
            created_at=now,
        )
        db.add(row)
        await db.flush()
        await run_virus_scan(db, row, scan_path)
        return attachment_to_read(row, user=user)
    finally:
        scan_path.unlink(missing_ok=True)


def _ensure_clean_attachment(attachment: Attachment) -> None:
    if attachment.scan_status != "clean":
        raise HTTPException(status_code=403, detail="Attachment not available until scan completes")


async def build_attachment_download_response(
    attachment: Attachment,
) -> FileResponse | RedirectResponse | Response:
    """Return file bytes (private blob), redirect (public blob), or FileResponse (local disk)."""
    _ensure_clean_attachment(attachment)
    disposition = (
        "inline"
        if attachment.content_type.startswith("image/")
        or attachment.content_type == "application/pdf"
        else "attachment"
    )
    content_disposition = f'{disposition}; filename="{attachment.filename}"'

    if file_storage.is_blob_storage_key(attachment.storage_key):
        public_url = file_storage.public_blob_download_url(attachment.storage_key)
        if public_url:
            return RedirectResponse(url=public_url, status_code=307)
        body = await file_storage.read_blob_bytes(attachment.storage_key)
        return Response(
            content=body,
            media_type=attachment.content_type,
            headers={"Content-Disposition": content_disposition},
        )

    if file_storage.is_vercel_serverless():
        raise HTTPException(
            status_code=404,
            detail=file_storage.FILE_NOT_FOUND_DETAIL_DA,
        )

    path = Path(attachment.storage_key)
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail=file_storage.FILE_NOT_FOUND_DETAIL_DA,
        )
    return FileResponse(
        path,
        media_type=attachment.content_type,
        filename=attachment.filename,
        content_disposition_type=disposition,
    )

