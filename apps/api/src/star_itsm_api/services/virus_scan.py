"""Virus scan placeholder — replace with ClamAV / cloud scanner in production."""

import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.attachment import Attachment

logger = logging.getLogger(__name__)

BLOCKED_EXTENSIONS = frozenset(
    {".exe", ".bat", ".cmd", ".ps1", ".vbs", ".js", ".jar", ".msi", ".dll", ".scr"}
)
MAX_SCAN_BYTES = 15 * 1024 * 1024


async def run_virus_scan(db: AsyncSession, attachment: Attachment, file_path: Path) -> None:
    attachment.scan_status = "scanning"
    await db.flush()

    try:
        if not file_path.exists():
            attachment.scan_status = "failed"
            attachment.scan_detail = "File missing on storage"
            attachment.scanned_at = datetime.now(UTC)
            return

        size = file_path.stat().st_size
        if size > MAX_SCAN_BYTES:
            attachment.scan_status = "failed"
            attachment.scan_detail = "File exceeds scan size limit"
            attachment.scanned_at = datetime.now(UTC)
            return

        suffix = file_path.suffix.lower()
        if suffix in BLOCKED_EXTENSIONS:
            attachment.scan_status = "infected"
            attachment.scan_detail = f"Blocked file type: {suffix}"
            attachment.scanned_at = datetime.now(UTC)
            file_path.unlink(missing_ok=True)
            return

        # Prototype: read header bytes — reject known executable magic
        header = file_path.read_bytes()[:8]
        if header.startswith(b"MZ") or header.startswith(b"\x7fELF"):
            attachment.scan_status = "infected"
            attachment.scan_detail = "Executable content blocked"
            attachment.scanned_at = datetime.now(UTC)
            file_path.unlink(missing_ok=True)
            return

        # Production: invoke ClamAV / Defender API here
        attachment.scan_status = "clean"
        attachment.scan_detail = "Prototype scan passed"
        attachment.scanned_at = datetime.now(UTC)
    except OSError as exc:
        logger.exception("Virus scan failed for attachment %s", attachment.id)
        attachment.scan_status = "failed"
        attachment.scan_detail = str(exc)[:500]
        attachment.scanned_at = datetime.now(UTC)


async def scan_pending_attachments(db: AsyncSession, limit: int = 20) -> int:
    from sqlalchemy import select

    result = await db.execute(
        select(Attachment).where(Attachment.scan_status == "pending").limit(limit)
    )
    count = 0
    for attachment in result.scalars().all():
        await run_virus_scan(db, attachment, Path(attachment.storage_key))
        count += 1
    return count
