import uuid
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.models.attachment import Attachment
from star_itsm_api.services import file_storage, virus_scan


def _attachment(*, storage_key: str, scan_status: str = "pending") -> Attachment:
    return Attachment(
        id=uuid.uuid4(),
        ticket_id=uuid.uuid4(),
        comment_id=None,
        uploader_user_id=uuid.uuid4(),
        filename="file.png",
        content_type="image/png",
        size_bytes=4,
        storage_key=storage_key,
        scan_status=scan_status,
        scanned_at=None,
        scan_detail=None,
        visible_to_submitter=False,
        created_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_run_virus_scan_marks_clean_png(tmp_path: Path) -> None:
    scan_file = tmp_path / "photo.png"
    scan_file.write_bytes(b"\x89PNG\r\n\x1a\n")
    attachment = _attachment(storage_key=str(scan_file))
    db = AsyncMock()

    await virus_scan.run_virus_scan(db, attachment, scan_file)

    assert attachment.scan_status == "clean"
    assert attachment.scan_detail == "Prototype scan passed"
    assert attachment.scanned_at is not None
    db.flush.assert_awaited()


@pytest.mark.asyncio
async def test_run_virus_scan_missing_file(tmp_path: Path) -> None:
    missing = tmp_path / "gone.png"
    attachment = _attachment(storage_key=str(missing))
    db = AsyncMock()

    await virus_scan.run_virus_scan(db, attachment, missing)

    assert attachment.scan_status == "failed"
    assert attachment.scan_detail == "File missing on storage"


@pytest.mark.asyncio
async def test_run_virus_scan_rejects_oversized_file(tmp_path: Path) -> None:
    scan_file = tmp_path / "big.bin"
    scan_file.write_bytes(b"x" * (virus_scan.MAX_SCAN_BYTES + 1))
    attachment = _attachment(storage_key=str(scan_file))
    db = AsyncMock()

    await virus_scan.run_virus_scan(db, attachment, scan_file)

    assert attachment.scan_status == "failed"
    assert "size limit" in (attachment.scan_detail or "")


@pytest.mark.asyncio
async def test_run_virus_scan_blocks_exe_and_deletes(tmp_path: Path) -> None:
    scan_file = tmp_path / "malware.exe"
    scan_file.write_bytes(b"MZfake")
    attachment = _attachment(storage_key=str(scan_file))
    db = AsyncMock()

    await virus_scan.run_virus_scan(db, attachment, scan_file)

    assert attachment.scan_status == "infected"
    assert ".exe" in (attachment.scan_detail or "")
    assert not scan_file.exists()


@pytest.mark.asyncio
async def test_run_virus_scan_blocks_elf_magic(tmp_path: Path) -> None:
    scan_file = tmp_path / "binary.bin"
    scan_file.write_bytes(b"\x7fELF\x00")
    attachment = _attachment(storage_key=str(scan_file))
    db = AsyncMock()

    await virus_scan.run_virus_scan(db, attachment, scan_file)

    assert attachment.scan_status == "infected"
    assert attachment.scan_detail == "Executable content blocked"
    assert not scan_file.exists()


@pytest.mark.asyncio
async def test_scan_pending_attachments_local_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    local = tmp_path / "upload.png"
    local.write_bytes(b"\x89PNG\r\n\x1a\n")
    attachment = _attachment(storage_key=str(local))

    result = MagicMock()
    result.scalars.return_value.all.return_value = [attachment]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)

    count = await virus_scan.scan_pending_attachments(db, limit=5)

    assert count == 1
    assert attachment.scan_status == "clean"


@pytest.mark.asyncio
async def test_scan_pending_attachments_blob_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    attachment = _attachment(
        storage_key="blob:https://store.public.blob.vercel-storage.com/t.png",
    )
    temp_file = tmp_path / "temp.png"
    temp_file.write_bytes(b"\x89PNG\r\n\x1a\n")

    result = MagicMock()
    result.scalars.return_value.all.return_value = [attachment]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)

    monkeypatch.setattr(
        file_storage,
        "read_blob_bytes",
        AsyncMock(return_value=b"\x89PNG\r\n\x1a\n"),
    )
    monkeypatch.setattr(
        file_storage,
        "write_temp_upload",
        lambda content, suffix: temp_file,
    )

    count = await virus_scan.scan_pending_attachments(db)

    assert count == 1
    assert attachment.scan_status == "clean"
    file_storage.read_blob_bytes.assert_awaited_once()
