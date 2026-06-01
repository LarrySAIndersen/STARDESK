import uuid
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException, UploadFile
from httpx import AsyncClient

from star_itsm_api.core.config import settings
from star_itsm_api.main import app
from star_itsm_api.models.attachment import Attachment
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services import attachments, file_storage


@pytest.fixture
def clean_attachment(tmp_path: Path) -> Attachment:
    local = tmp_path / "photo.png"
    local.write_bytes(b"test")
    return Attachment(
        id=uuid.uuid4(),
        ticket_id=uuid.uuid4(),
        comment_id=None,
        uploader_user_id=uuid.uuid4(),
        filename="photo.png",
        content_type="image/png",
        size_bytes=4,
        storage_key=str(local),
        scan_status="clean",
        scanned_at=None,
        scan_detail=None,
        visible_to_submitter=False,
        created_at=__import__("datetime").datetime.now(__import__("datetime").UTC),
    )




def test_is_blob_storage_key(tmp_path: Path) -> None:
    assert file_storage.is_blob_storage_key("blob:https://x.blob.vercel-storage.com/a.png")
    assert not file_storage.is_blob_storage_key(str(tmp_path / "a.png"))


def test_storage_key_is_retrievable_blob() -> None:
    assert file_storage.storage_key_is_retrievable(
        "blob:https://store.public.blob.vercel-storage.com/t.png"
    )


def test_storage_key_is_retrievable_local_missing(tmp_path: Path) -> None:
    assert not file_storage.storage_key_is_retrievable(str(tmp_path / "does-not-exist.png"))


def test_storage_key_is_retrievable_local_present(tmp_path: Path) -> None:
    local = tmp_path / "photo.png"
    local.write_bytes(b"x")
    assert file_storage.storage_key_is_retrievable(str(local))


def test_storage_key_not_retrievable_on_vercel_local(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("VERCEL", "1")
    local = tmp_path / "uploads" / "ticket" / "file.png"
    assert not file_storage.storage_key_is_retrievable(str(local))


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
    monkeypatch.setattr(settings, "blob_read_write_token", "test-token")

    data = await file_storage.read_blob_bytes(
        "blob:https://store.public.blob.vercel-storage.com/t.png"
    )
    assert data == b"\x89PNG"
    mock_client.get.assert_awaited()
    call_kwargs = mock_client.get.await_args.kwargs
    assert call_kwargs["headers"]["Authorization"] == "Bearer test-token"


@pytest.mark.asyncio
async def test_read_blob_bytes_private_with_token(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"secret"

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    monkeypatch.setattr(file_storage.httpx, "AsyncClient", lambda **_: mock_client)
    monkeypatch.setattr(settings, "blob_read_write_token", "rw-token")

    data = await file_storage.read_blob_bytes(
        "blob:https://store.private.blob.vercel-storage.com/t.png"
    )
    assert data == b"secret"


@pytest.mark.asyncio
async def test_build_attachment_download_public_blob_redirect(clean_attachment) -> None:
    clean_attachment.storage_key = "blob:https://store.public.blob.vercel-storage.com/t.png"

    response = await attachments.build_attachment_download_response(clean_attachment)
    assert response.status_code == 307
    assert response.headers["location"] == "https://store.public.blob.vercel-storage.com/t.png"


@pytest.mark.asyncio
async def test_build_attachment_download_private_blob(
    monkeypatch: pytest.MonkeyPatch, clean_attachment
) -> None:
    clean_attachment.storage_key = "blob:https://store.private.blob.vercel-storage.com/t.png"
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
async def test_build_attachment_download_local_file(tmp_path: Path, clean_attachment) -> None:
    local_file = tmp_path / "photo.png"
    local_file.write_bytes(b"data")
    clean_attachment.storage_key = str(local_file)

    response = await attachments.build_attachment_download_response(clean_attachment)
    assert response.path == local_file
    assert response.media_type == "image/png"


@pytest.mark.asyncio
async def test_build_attachment_download_missing_local_returns_404(
    clean_attachment, tmp_path: Path
) -> None:
    clean_attachment.storage_key = str(tmp_path / "does-not-exist-attachment.png")
    with pytest.raises(HTTPException) as exc:
        await attachments.build_attachment_download_response(clean_attachment)
    assert exc.value.status_code == 404
    assert exc.value.detail == file_storage.FILE_NOT_FOUND_DETAIL_DA


@pytest.mark.asyncio
async def test_build_attachment_download_vercel_local_returns_404(
    monkeypatch: pytest.MonkeyPatch, clean_attachment, tmp_path: Path
) -> None:
    monkeypatch.setenv("VERCEL", "1")
    clean_attachment.storage_key = str(tmp_path / "uploads" / "ticket" / "file.png")
    with pytest.raises(HTTPException) as exc:
        await attachments.build_attachment_download_response(clean_attachment)
    assert exc.value.status_code == 404
    assert exc.value.detail == file_storage.FILE_NOT_FOUND_DETAIL_DA


@pytest.mark.parametrize("app_env", ["production", "development"])
def test_require_attachment_storage_on_vercel_without_token(
    monkeypatch: pytest.MonkeyPatch,
    app_env: str,
) -> None:
    monkeypatch.setattr(settings, "app_env", app_env)
    monkeypatch.setattr(settings, "blob_read_write_token", None)
    monkeypatch.setenv("VERCEL", "1")
    with pytest.raises(HTTPException) as exc:
        file_storage.require_attachment_storage_configured()
    assert exc.value.status_code == 503
    assert "BLOB_READ_WRITE_TOKEN" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_persist_to_blob_upload(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "blob_read_write_token", "vercel_blob_rw_teststore_secret")
    monkeypatch.setattr(settings, "blob_store_id", None)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "url": "https://teststore.private.blob.vercel-storage.com/attachments/x.png"
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
    assert key == "blob:https://teststore.private.blob.vercel-storage.com/attachments/x.png"
    mock_client.put.assert_awaited_once()
    call_url = mock_client.put.await_args.args[0]
    assert call_url == "https://vercel.com/api/blob"
    call_params = mock_client.put.await_args.kwargs["params"]
    assert call_params == {"pathname": "attachments/ticket/id_file.png"}
    call_headers = mock_client.put.await_args.kwargs["headers"]
    assert call_headers["x-vercel-blob-access"] == "private"
    assert call_headers["x-vercel-blob-store-id"] == "teststore"
    assert call_headers["x-api-version"] == "12"


def test_can_delete_attachment_uploader_and_admin(clean_attachment) -> None:
    uploader_id = clean_attachment.uploader_user_id
    uploader = SimpleNamespace(id=uploader_id, role="agent")
    other = SimpleNamespace(id=uuid.uuid4(), role="agent")
    admin = SimpleNamespace(id=uuid.uuid4(), role="admin")
    assert attachments.can_delete_attachment(uploader, clean_attachment) is True
    assert attachments.can_delete_attachment(admin, clean_attachment) is True
    assert attachments.can_delete_attachment(other, clean_attachment) is False


def test_attachment_to_read_marks_legacy_vercel_local_unavailable(
    monkeypatch: pytest.MonkeyPatch, clean_attachment, tmp_path: Path
) -> None:
    monkeypatch.setenv("VERCEL", "1")
    clean_attachment.storage_key = str(tmp_path / "uploads" / "ticket" / "file.png")
    staff = SimpleNamespace(role="admin")
    read = attachments.attachment_to_read(clean_attachment, user=staff)
    assert read.file_retrievable is False
    assert read.download_available is False
    assert read.file_unavailable_label_da == file_storage.FILE_UNAVAILABLE_LABEL_DA


@pytest.mark.asyncio
async def test_download_ticket_attachment_happy_path_blob(
    api_client: AsyncClient,
    mock_db: AsyncMock,
    clean_attachment,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ticket_id = clean_attachment.ticket_id
    attachment_id = clean_attachment.id
    ticket = Ticket(
        id=ticket_id,
        reporter_user_id=uuid.uuid4(),
        deleted_at=None,
    )
    clean_attachment.storage_key = "blob:https://store.public.blob.vercel-storage.com/t.png"

    async def _get(model, pk):
        if model is Ticket:
            return ticket
        if model is Attachment:
            return clean_attachment
        return None

    mock_db.get = AsyncMock(side_effect=_get)
    monkeypatch.setattr(
        "star_itsm_api.routers.tickets._ensure_ticket_access",
        AsyncMock(),
    )

    response = await api_client.get(
        f"/api/v1/tickets/{ticket_id}/attachments/{attachment_id}/download"
    )
    assert response.status_code == 307
    assert response.headers["location"] == "https://store.public.blob.vercel-storage.com/t.png"


@pytest.mark.asyncio
async def test_download_ticket_attachment_missing_file(
    api_client: AsyncClient,
    mock_db: AsyncMock,
    clean_attachment,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    ticket_id = clean_attachment.ticket_id
    attachment_id = clean_attachment.id
    ticket = Ticket(
        id=ticket_id,
        reporter_user_id=uuid.uuid4(),
        deleted_at=None,
    )
    clean_attachment.storage_key = str(tmp_path / "uploads" / "missing.png")

    async def _get(model, pk):
        if model is Ticket:
            return ticket
        if model is Attachment:
            return clean_attachment
        return None

    mock_db.get = AsyncMock(side_effect=_get)
    monkeypatch.setattr(
        "star_itsm_api.routers.tickets._ensure_ticket_access",
        AsyncMock(),
    )
    monkeypatch.setenv("VERCEL", "1")

    response = await api_client.get(
        f"/api/v1/tickets/{ticket_id}/attachments/{attachment_id}/download"
    )
    assert response.status_code == 404
    assert response.json()["detail"] == file_storage.FILE_NOT_FOUND_DETAIL_DA


def test_attachment_to_read_pending_scan_not_downloadable(clean_attachment) -> None:
    clean_attachment.scan_status = "pending"
    staff = SimpleNamespace(role="admin")
    read = attachments.attachment_to_read(clean_attachment, user=staff)
    assert read.download_available is False
    assert read.scan_status_label_da == "Afventer virusscan"


def test_attachment_to_read_submitter_visible_when_clean(clean_attachment) -> None:
    clean_attachment.scan_status = "clean"
    clean_attachment.visible_to_submitter = True
    submitter = SimpleNamespace(id=clean_attachment.uploader_user_id, role="end_user")
    read = attachments.attachment_to_read(clean_attachment, user=submitter)
    assert read.download_available is True


def test_attachment_to_read_submitter_hidden_when_not_visible(clean_attachment) -> None:
    clean_attachment.scan_status = "clean"
    clean_attachment.visible_to_submitter = False
    submitter = SimpleNamespace(id=clean_attachment.uploader_user_id, role="end_user")
    read = attachments.attachment_to_read(clean_attachment, user=submitter)
    assert read.download_available is False


@pytest.mark.asyncio
async def test_build_attachment_download_blocks_non_clean(clean_attachment) -> None:
    clean_attachment.scan_status = "infected"
    with pytest.raises(HTTPException) as exc:
        await attachments.build_attachment_download_response(clean_attachment)
    assert exc.value.status_code == 403
    assert "scan" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_list_ticket_attachments_denies_unrelated_user(mock_db: AsyncMock) -> None:
    ticket_id = uuid.uuid4()
    reporter_id = uuid.uuid4()
    stranger = SimpleNamespace(id=uuid.uuid4(), role="submitter")
    rows = await attachments.list_ticket_attachments_for_detail(
        mock_db,
        ticket_id,
        stranger,
        reporter_user_id=reporter_id,
    )
    assert rows == []


@pytest.mark.asyncio
async def test_delete_ticket_attachment_not_found(mock_db: AsyncMock) -> None:
    mock_db.get = AsyncMock(return_value=None)
    admin = SimpleNamespace(id=uuid.uuid4(), role="admin")
    with pytest.raises(HTTPException) as exc:
        await attachments.delete_ticket_attachment(
            mock_db,
            ticket_id=uuid.uuid4(),
            attachment_id=uuid.uuid4(),
            user=admin,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_delete_ticket_attachment_forbidden(mock_db: AsyncMock, clean_attachment) -> None:
    mock_db.get = AsyncMock(return_value=clean_attachment)
    other = SimpleNamespace(id=uuid.uuid4(), role="agent")
    with pytest.raises(HTTPException) as exc:
        await attachments.delete_ticket_attachment(
            mock_db,
            ticket_id=clean_attachment.ticket_id,
            attachment_id=clean_attachment.id,
            user=other,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_save_ticket_upload_rejects_empty_filename(mock_db: AsyncMock) -> None:
    upload = UploadFile(filename="   ", file=MagicMock())
    user = SimpleNamespace(id=uuid.uuid4(), role="admin")
    with pytest.raises(HTTPException) as exc:
        await attachments.save_ticket_upload(
            mock_db,
            ticket_id=uuid.uuid4(),
            ticket_number="INC-1",
            user=user,
            upload=upload,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_save_ticket_upload_rejects_disallowed_type(mock_db: AsyncMock) -> None:
    upload = UploadFile(
        filename="app.exe",
        file=BytesIO(b"data"),
        headers={"content-type": "application/x-msdownload"},
    )
    user = SimpleNamespace(id=uuid.uuid4(), role="admin")
    with pytest.raises(HTTPException) as exc:
        await attachments.save_ticket_upload(
            mock_db,
            ticket_id=uuid.uuid4(),
            ticket_number="INC-1",
            user=user,
            upload=upload,
        )
    assert exc.value.status_code == 400
    assert "type" in exc.value.detail.lower()
