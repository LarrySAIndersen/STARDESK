import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from star_itsm_api.core.config import settings
from star_itsm_api.models.attachment import Attachment
from star_itsm_api.services import attachments, file_storage


@pytest.fixture
def clean_attachment() -> Attachment:
    return Attachment(
        id=uuid.uuid4(),
        ticket_id=uuid.uuid4(),
        comment_id=None,
        uploader_user_id=uuid.uuid4(),
        filename="photo.png",
        content_type="image/png",
        size_bytes=4,
        storage_key="/tmp/photo.png",
        scan_status="clean",
        scanned_at=None,
        scan_detail=None,
        visible_to_submitter=False,
        created_at=__import__("datetime").datetime.now(__import__("datetime").UTC),
    )


def test_is_blob_storage_key() -> None:
    assert file_storage.is_blob_storage_key("blob:https://x.blob.vercel-storage.com/a.png")
    assert not file_storage.is_blob_storage_key("/tmp/a.png")


@pytest.mark.asyncio
async def test_read_blob_bytes_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"\x89PNG"

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    monkeypatch.setattr(file_storage.httpx, "AsyncClient", lambda **_: mock_client)

    data = await file_storage.read_blob_bytes("blob:https://store.public.blob.vercel-storage.com/t.png")
    assert data == b"\x89PNG"
    mock_client.get.assert_awaited_once_with(
        "https://store.public.blob.vercel-storage.com/t.png?download=1"
    )


@pytest.mark.asyncio
async def test_build_attachment_download_blob(monkeypatch: pytest.MonkeyPatch, clean_attachment) -> None:
    clean_attachment.storage_key = "blob:https://store.public.blob.vercel-storage.com/t.png"
    monkeypatch.setattr(
        file_storage,
        "read_blob_bytes",
        AsyncMock(return_value=b"\x89PNG"),
    )

    response = await attachments.build_attachment_download_response(clean_attachment)
    assert response.body == b"\x89PNG"
    assert response.media_type == "image/png"
    assert "inline" in response.headers["content-disposition"]


@pytest.mark.asyncio
async def test_build_attachment_download_local_file(
    tmp_path: Path, clean_attachment
) -> None:
    local_file = tmp_path / "photo.png"
    local_file.write_bytes(b"data")
    clean_attachment.storage_key = str(local_file)

    response = await attachments.build_attachment_download_response(clean_attachment)
    assert response.path == local_file
    assert response.media_type == "image/png"


@pytest.mark.asyncio
async def test_build_attachment_download_missing_local_returns_404(clean_attachment) -> None:
    clean_attachment.storage_key = "/tmp/does-not-exist-attachment.png"
    with pytest.raises(HTTPException) as exc:
        await attachments.build_attachment_download_response(clean_attachment)
    assert exc.value.status_code == 404
    assert exc.value.detail == "File not found"


def test_require_attachment_storage_on_vercel_without_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "blob_read_write_token", None)
    monkeypatch.setenv("VERCEL", "1")
    with pytest.raises(HTTPException) as exc:
        file_storage.require_attachment_storage_configured()
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_persist_to_blob_upload(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "blob_read_write_token", "test-token")

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "url": "https://store.public.blob.vercel-storage.com/attachments/x.png"
    }

    mock_client = AsyncMock()
    mock_client.put = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    monkeypatch.setattr(file_storage.httpx, "AsyncClient", lambda **_: mock_client)

    key = await file_storage.persist_to_blob(
        pathname="attachments/ticket/id_file.png",
        content=b"png",
        content_type="image/png",
    )
    assert key.startswith("blob:https://")
    mock_client.put.assert_awaited_once()
