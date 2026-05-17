import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.config import settings
from star_itsm_api.core.security import ROLE_SUBMITTER, is_staff
from star_itsm_api.models.attachment import Attachment
from star_itsm_api.models.user import User
from star_itsm_api.schemas.attachment import AttachmentRead
from star_itsm_api.services.virus_scan import run_virus_scan

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
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def upload_root() -> Path:
    root = Path(settings.upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def attachment_to_read(row: Attachment, *, user: User) -> AttachmentRead:
    can_download = row.scan_status == "clean" and (
        is_staff(user) or (user.role == ROLE_SUBMITTER and row.visible_to_submitter)
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
        download_available=can_download,
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
        )
        for row in rows
    ]


async def save_ticket_upload(
    db: AsyncSession,
    *,
    ticket_id: uuid.UUID,
    user: User,
    upload: UploadFile,
) -> AttachmentRead:
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
    storage_path = upload_root() / str(ticket_id) / f"{attachment_id}_{safe_name}"
    storage_path.parent.mkdir(parents=True, exist_ok=True)
    storage_path.write_bytes(content)

    now = datetime.now(UTC)
    row = Attachment(
        id=attachment_id,
        ticket_id=ticket_id,
        comment_id=None,
        uploader_user_id=user.id,
        filename=safe_name,
        content_type=content_type,
        size_bytes=len(content),
        storage_key=str(storage_path),
        scan_status="pending",
        scanned_at=None,
        scan_detail=None,
        visible_to_submitter=False,
        created_at=now,
    )
    db.add(row)
    await db.flush()
    await run_virus_scan(db, row, storage_path)
    return attachment_to_read(row, user=user)


def resolve_download_path(attachment: Attachment) -> Path:
    if attachment.scan_status != "clean":
        raise HTTPException(status_code=403, detail="Attachment not available until scan completes")
    path = Path(attachment.storage_key)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return path
