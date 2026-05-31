"""Ticket attachment storage: local disk (dev) or Vercel Blob (production)."""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path

import httpx
from fastapi import HTTPException

from star_itsm_api.core.config import settings

logger = logging.getLogger(__name__)

BLOB_STORAGE_PREFIX = "blob:"
_BLOB_API_BASE = "https://vercel.com/api/blob"
_BLOB_API_VERSION = "12"
FILE_NOT_FOUND_DETAIL_DA = "Filen findes ikke længere. Upload vedhæftningen igen."
FILE_UNAVAILABLE_LABEL_DA = "Filen findes ikke længere — upload igen"


def blob_storage_enabled() -> bool:
    return bool(settings.blob_read_write_token)


def is_blob_storage_key(storage_key: str) -> bool:
    return storage_key.startswith(BLOB_STORAGE_PREFIX)


def blob_url_from_storage_key(storage_key: str) -> str:
    return storage_key[len(BLOB_STORAGE_PREFIX) :]


def is_vercel_serverless() -> bool:
    return bool(os.getenv("VERCEL"))


def is_public_blob_url(url: str) -> bool:
    return ".public.blob.vercel-storage.com" in url


def public_blob_download_url(storage_key: str) -> str | None:
    """Direct CDN URL for public blobs — safe to redirect browsers to."""
    if not is_blob_storage_key(storage_key):
        return None
    url = blob_url_from_storage_key(storage_key)
    if is_public_blob_url(url):
        return url
    return None


def storage_key_is_retrievable(storage_key: str) -> bool:
    """Best-effort check without network I/O (used when listing attachments)."""
    if is_blob_storage_key(storage_key):
        return True
    if is_vercel_serverless():
        return False
    return Path(storage_key).is_file()


def require_attachment_storage_configured() -> None:
    """On Vercel serverless, local disk is ephemeral — Blob token is required (all environments)."""
    if is_vercel_serverless() and not blob_storage_enabled():
        raise HTTPException(
            status_code=503,
            detail=(
                "Vedhæftelser kan ikke gemmes på serveren "
                "(mangler BLOB_READ_WRITE_TOKEN på API-projektet). "
                "Opret et Vercel Blob-store og link det til api-projektet, derefter redeploy."
            ),
        )


def attachment_pathname(*, ticket_id: str, attachment_id: str, filename: str) -> str:
    return f"attachments/{ticket_id}/{attachment_id}_{filename}"


def write_temp_upload(content: bytes, *, suffix: str) -> Path:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f"_{suffix}")
    try:
        tmp.write(content)
        tmp.flush()
    finally:
        tmp.close()
    return Path(tmp.name)


def _blob_upload_access() -> str:
    mode = (settings.blob_access or "private").strip().lower()
    return mode if mode in {"private", "public"} else "private"


def _parse_store_id_from_read_write_token(token: str) -> str | None:
    """Extract store id from vercel_blob_rw_<storeId>_… tokens (matches @vercel/blob SDK)."""
    parts = token.split("_")
    if len(parts) >= 4 and parts[3]:
        return parts[3]
    return None


def _normalize_store_id(store_id: str) -> str:
    trimmed = store_id.strip()
    if trimmed.startswith("store_"):
        return trimmed[len("store_") :]
    return trimmed


def _resolve_blob_store_id(token: str) -> str:
    configured = settings.blob_store_id
    if configured:
        return _normalize_store_id(configured)
    parsed = _parse_store_id_from_read_write_token(token)
    if parsed:
        return parsed
    raise HTTPException(
        status_code=503,
        detail=(
            "BLOB_STORE_ID is not configured and could not be derived from BLOB_READ_WRITE_TOKEN"
        ),
    )


async def persist_to_blob(*, pathname: str, content: bytes, content_type: str) -> str:
    token = settings.blob_read_write_token
    if not token:
        raise HTTPException(status_code=503, detail="BLOB_READ_WRITE_TOKEN is not configured")

    store_id = _resolve_blob_store_id(token)
    headers = {
        "x-vercel-blob-access": _blob_upload_access(),
        "authorization": f"Bearer {token}",
        "x-api-version": _BLOB_API_VERSION,
        "x-content-type": content_type,
        "x-allow-overwrite": "1",
        "x-vercel-blob-store-id": store_id,
        "x-content-length": str(len(content)),
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.put(
            _BLOB_API_BASE,
            params={"pathname": pathname},
            content=content,
            headers=headers,
        )
    if response.status_code != 200:
        logger.error("Vercel Blob upload failed: %s %s", response.status_code, response.text[:500])
        raise HTTPException(status_code=502, detail="Failed to store attachment")
    payload = response.json()
    url = payload.get("url")
    if not isinstance(url, str) or not url:
        raise HTTPException(status_code=502, detail="Invalid blob upload response")
    return f"{BLOB_STORAGE_PREFIX}{url}"


def _blob_download_headers() -> dict[str, str]:
    token = settings.blob_read_write_token
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}"}


async def read_blob_bytes(storage_key: str) -> bytes:
    url = blob_url_from_storage_key(storage_key)
    headers = _blob_download_headers()
    candidates = (f"{url}?download=1", url)
    async with httpx.AsyncClient(timeout=60.0) as client:
        for fetch_url in candidates:
            response = await client.get(fetch_url, headers=headers)
            if response.status_code == 200:
                return response.content
            logger.warning("Blob download failed for %s: %s", fetch_url, response.status_code)
    raise HTTPException(status_code=404, detail=FILE_NOT_FOUND_DETAIL_DA)


def persist_to_local_disk(
    *, ticket_id: str, attachment_id: str, filename: str, content: bytes
) -> Path:
    root = Path(settings.upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    storage_path = root / ticket_id / f"{attachment_id}_{filename}"
    storage_path.parent.mkdir(parents=True, exist_ok=True)
    storage_path.write_bytes(content)
    return storage_path
