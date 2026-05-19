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


def avatar_public_path(user_id: uuid.UUID) -> str:
    return f"/api/v1/users/{user_id}/avatar"


def avatars_dir() -> Path:
    path = upload_root() / "avatars"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _avatar_file_path(user_id: uuid.UUID, ext: str) -> Path:
    return avatars_dir() / f"{user_id}{ext}"


def resolve_avatar_file(user_id: uuid.UUID) -> Path | None:
    directory = avatars_dir()
    for ext in _EXT_BY_TYPE.values():
        candidate = directory / f"{user_id}{ext}"
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
    if content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Kun billeder (JPEG, PNG, GIF, WebP) er tilladt",
        )

    content = await upload.read()
    if not content:
        raise HTTPException(status_code=400, detail="Tom fil")
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="Billedet er for stort (maks. 2 MB)")

    ext = _EXT_BY_TYPE[content_type]
    directory = avatars_dir()
    for existing in directory.glob(f"{user.id}.*"):
        if existing.is_file():
            existing.unlink()

    storage_path = _avatar_file_path(user.id, ext)
    storage_path.write_bytes(content)

    public_url = avatar_public_path(user.id)
    user.avatar_url = public_url
    user.avatar_preset_id = None
    await db.commit()
    await db.refresh(user)
    return public_url
