from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from star_itsm_api.services.file_storage import (
    _blob_download_headers,
    _blob_upload_access,
    _normalize_store_id,
    _parse_store_id_from_read_write_token,
    _resolve_blob_store_id,
    attachment_pathname,
    blob_storage_enabled,
    blob_url_from_storage_key,
    is_blob_storage_key,
    is_public_blob_url,
    is_vercel_serverless,
    persist_to_blob,
    persist_to_local_disk,
    public_blob_download_url,
    read_blob_bytes,
    require_attachment_storage_configured,
    storage_key_is_retrievable,
    write_temp_upload,
)


def test_blob_storage_enabled(monkeypatch) -> None:
    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_read_write_token="token"))
    assert blob_storage_enabled() is True

    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_read_write_token=""))
    assert blob_storage_enabled() is False


def test_is_blob_storage_key() -> None:
    assert is_blob_storage_key("blob:https://example.com") is True
    assert is_blob_storage_key("local/path/to/file") is False


def test_blob_url_from_storage_key() -> None:
    assert blob_url_from_storage_key("blob:https://example.com") == "https://example.com"


def test_is_vercel_serverless(monkeypatch) -> None:
    monkeypatch.setenv("VERCEL", "1")
    assert is_vercel_serverless() is True

    monkeypatch.delenv("VERCEL", raising=False)
    assert is_vercel_serverless() is False


def test_is_public_blob_url() -> None:
    assert is_public_blob_url("https://abc.public.blob.vercel-storage.com/file.png") is True
    assert is_public_blob_url("https://abc.private.blob.vercel-storage.com/file.png") is False


def test_public_blob_download_url() -> None:
    assert public_blob_download_url("blob:https://abc.public.blob.vercel-storage.com/file.png") == "https://abc.public.blob.vercel-storage.com/file.png"
    assert public_blob_download_url("blob:https://abc.private.blob.vercel-storage.com/file.png") is None
    assert public_blob_download_url("local/path") is None


def test_storage_key_is_retrievable(monkeypatch, tmp_path) -> None:
    # 1. Blob storage key
    assert storage_key_is_retrievable("blob:https://example.com") is True

    # 2. Vercel serverless (always False for local files)
    monkeypatch.setenv("VERCEL", "1")
    assert storage_key_is_retrievable("local/path") is False

    # 3. Local disk, file exists
    monkeypatch.delenv("VERCEL", raising=False)
    existing_file = tmp_path / "test.txt"
    existing_file.write_text("hello")
    assert storage_key_is_retrievable(str(existing_file)) is True

    # 4. Local disk, file does not exist
    assert storage_key_is_retrievable(str(tmp_path / "nonexistent.txt")) is False


def test_require_attachment_storage_configured(monkeypatch) -> None:
    # 1. Vercel serverless and blob not enabled -> raises 503
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_read_write_token=""))
    with pytest.raises(HTTPException) as exc:
        require_attachment_storage_configured()
    assert exc.value.status_code == 503

    # 2. Vercel serverless and blob is enabled -> ok
    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_read_write_token="token"))
    require_attachment_storage_configured()

    # 3. Not Vercel serverless -> ok
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_read_write_token=""))
    require_attachment_storage_configured()


def test_attachment_pathname() -> None:
    assert attachment_pathname(ticket_id="t1", attachment_id="a1", filename="f.txt") == "attachments/t1/a1_f.txt"


def test_write_temp_upload() -> None:
    path = write_temp_upload(b"test content", suffix="test")
    assert path.exists()
    assert path.read_bytes() == b"test content"
    assert "_test" in path.name
    # Cleanup
    path.unlink()


def test_blob_upload_access(monkeypatch) -> None:
    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_access="public"))
    assert _blob_upload_access() == "public"

    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_access="private"))
    assert _blob_upload_access() == "private"

    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_access="invalid"))
    assert _blob_upload_access() == "private"


def test_parse_store_id_from_read_write_token() -> None:
    assert _parse_store_id_from_read_write_token("vercel_blob_rw_mystoreid_12345") == "mystoreid"
    assert _parse_store_id_from_read_write_token("invalid_token") is None


def test_normalize_store_id() -> None:
    assert _normalize_store_id("store_myid") == "myid"
    assert _normalize_store_id("myid") == "myid"


def test_resolve_blob_store_id(monkeypatch) -> None:
    # 1. Configured via settings.blob_store_id
    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_store_id="store_myid"))
    assert _resolve_blob_store_id("token") == "myid"

    # 2. Parsed from token
    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_store_id=""))
    assert _resolve_blob_store_id("vercel_blob_rw_tokenstore_123") == "tokenstore"

    # 3. Neither configured nor parsed -> raises 503
    with pytest.raises(HTTPException) as exc:
        _resolve_blob_store_id("invalid_token")
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_persist_to_blob_no_token(monkeypatch) -> None:
    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_read_write_token=""))
    with pytest.raises(HTTPException) as exc:
        await persist_to_blob(pathname="path", content=b"data", content_type="text/plain")
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_persist_to_blob_success(monkeypatch) -> None:
    monkeypatch.setattr(
        "star_itsm_api.services.file_storage.settings",
        SimpleNamespace(
            blob_read_write_token="vercel_blob_rw_mystore_123",
            blob_store_id="mystore",
            blob_access="public",
        ),
    )
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"url": "https://mystore.public.blob.vercel-storage.com/file.png"}
    
    with patch("httpx.AsyncClient.put", AsyncMock(return_value=mock_response)) as mock_put:
        res = await persist_to_blob(pathname="path", content=b"data", content_type="image/png")
        assert res == "blob:https://mystore.public.blob.vercel-storage.com/file.png"
        mock_put.assert_called_once()


@pytest.mark.asyncio
async def test_persist_to_blob_failures(monkeypatch) -> None:
    monkeypatch.setattr(
        "star_itsm_api.services.file_storage.settings",
        SimpleNamespace(
            blob_read_write_token="vercel_blob_rw_mystore_123",
            blob_store_id="mystore",
            blob_access="public",
        ),
    )
    
    # 1. Non-200 status code
    mock_response_fail = MagicMock()
    mock_response_fail.status_code = 400
    mock_response_fail.text = "Error message"
    
    with patch("httpx.AsyncClient.put", AsyncMock(return_value=mock_response_fail)):
        with pytest.raises(HTTPException) as exc:
            await persist_to_blob(pathname="path", content=b"data", content_type="image/png")
        assert exc.value.status_code == 502

    # 2. Invalid json response (no url)
    mock_response_invalid = MagicMock()
    mock_response_invalid.status_code = 200
    mock_response_invalid.json.return_value = {}
    
    with patch("httpx.AsyncClient.put", AsyncMock(return_value=mock_response_invalid)):
        with pytest.raises(HTTPException) as exc:
            await persist_to_blob(pathname="path", content=b"data", content_type="image/png")
        assert exc.value.status_code == 502


def test_blob_download_headers(monkeypatch) -> None:
    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_read_write_token=""))
    assert _blob_download_headers() == {}

    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_read_write_token="token"))
    assert _blob_download_headers() == {"Authorization": "Bearer token"}


@pytest.mark.asyncio
async def test_read_blob_bytes_success(monkeypatch) -> None:
    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_read_write_token="token"))
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"blob content"
    
    with patch("httpx.AsyncClient.get", AsyncMock(return_value=mock_response)) as mock_get:
        content = await read_blob_bytes("blob:https://example.com/file.png")
        assert content == b"blob content"
        mock_get.assert_called_once()


@pytest.mark.asyncio
async def test_read_blob_bytes_not_found(monkeypatch) -> None:
    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(blob_read_write_token="token"))
    
    mock_response = MagicMock()
    mock_response.status_code = 404
    
    with patch("httpx.AsyncClient.get", AsyncMock(return_value=mock_response)):
        with pytest.raises(HTTPException) as exc:
            await read_blob_bytes("blob:https://example.com/file.png")
        assert exc.value.status_code == 404


def test_persist_to_local_disk(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr("star_itsm_api.services.file_storage.settings", SimpleNamespace(upload_dir=str(tmp_path / "uploads")))
    
    ticket_id = "t_123"
    attachment_id = "a_456"
    filename = "test_file.txt"
    content = b"local disk content"
    
    path = persist_to_local_disk(
        ticket_id=ticket_id,
        attachment_id=attachment_id,
        filename=filename,
        content=content,
    )
    
    assert path.exists()
    assert path.read_bytes() == content
    assert path.parent.name == ticket_id
