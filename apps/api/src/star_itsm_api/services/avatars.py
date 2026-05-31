import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.user import User
from star_itsm_api.services.attachments import upload_root

ALLOWED_AVATAR_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
    }
)
MAX_AVATAR_BYTES = 2 * 1024 * 1024

_EXT_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}
_ALLOWED_EXTENSIONS = frozenset(_EXT_BY_TYPE.values())
_AVATAR_OBJECT_RE = re.compile(r"^[a-f0-9]{32}\.(jpg|png|gif|webp)$")


def avatar_public_path(user_id: uuid.UUID) -> str:
    return f"/api/v1/users/{user_id}/avatar"


def avatars_dir() -> Path:
    path = upload_root() / "avatars"
    path.mkdir(parents=True, exist_ok=True)
    return path


def extension_for_avatar_content_type(content_type: str) -> str:
    """Map a validated MIME type to a fixed on-disk extension (allowlist only)."""
    if content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Kun billeder (JPEG, PNG, GIF, WebP) er tilladt",
        )
    return _EXT_BY_TYPE[content_type]


def _safe_avatar_path(user_id: uuid.UUID, ext: str) -> Path:
    """Resolve avatar path and ensure it stays inside the avatars upload directory."""
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Ugyldig filtype")

    object_name = f"{user_id.hex}{ext}"
    if not _AVATAR_OBJECT_RE.fullmatch(object_name):
        raise HTTPException(status_code=400, detail="Ugyldig filsti")

    storage_root = avatars_dir().resolve()
    target = storage_root.joinpath(object_name).resolve()
    if target.parent != storage_root:
        raise HTTPException(status_code=400, detail="Ugyldig filsti") from None
    return target


def write_avatar_bytes(user_id: uuid.UUID, image_bytes: bytes, *, ext: str) -> Path:
    """Persist avatar bytes under the avatars upload root."""
    target = _safe_avatar_path(user_id, ext)
    target.write_bytes(image_bytes)
    return target


def resolve_avatar_file(user_id: uuid.UUID) -> Path | None:
    for ext in _ALLOWED_EXTENSIONS:
        candidate = _safe_avatar_path(user_id, ext)
        if candidate.is_file():
            return candidate
    return None


def resolve_avatar_media_type(path: Path) -> str:
    suffix = path.suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }.get(suffix, "application/octet-stream")


async def save_user_avatar(
    db: AsyncSession,
    user: User,
    upload: UploadFile,
) -> str:
    content_type = (upload.content_type or "").split(";")[0].strip().lower()
    ext = extension_for_avatar_content_type(content_type)

    content = await upload.read()
    if not content:
        raise HTTPException(status_code=400, detail="Tom fil")
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="Billedet er for stort (maks. 2 MB)")

    for existing_ext in _ALLOWED_EXTENSIONS:
        existing = _safe_avatar_path(user.id, existing_ext)
        if existing.is_file():
            existing.unlink()

    write_avatar_bytes(user.id, content, ext=ext)

    public_url = avatar_public_path(user.id)
    user.avatar_url = public_url
    user.avatar_preset_id = None
    await db.commit()
    await db.refresh(user)
    return public_url
