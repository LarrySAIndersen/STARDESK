import uuid
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException, UploadFile

from star_itsm_api.services import avatars


def test_avatar_public_path() -> None:
    user_id = uuid.uuid4()
    assert avatars.avatar_public_path(user_id) == f"/api/v1/users/{user_id}/avatar"


def test_avatars_dir_creates_subdirectory(tmp_path, monkeypatch) -> None:
    upload_root = tmp_path / "uploads"
    upload_root.mkdir()
    monkeypatch.setattr(avatars, "upload_root", lambda: upload_root)
    path = avatars.avatars_dir()
    assert path.exists()
    assert path.name == "avatars"


def test_extension_for_avatar_content_type() -> None:
    assert avatars.extension_for_avatar_content_type("image/png") == ".png"
    with pytest.raises(HTTPException) as exc:
        avatars.extension_for_avatar_content_type("application/pdf")
    assert exc.value.status_code == 400


def test_write_avatar_bytes_persists_file(tmp_path, monkeypatch) -> None:
    upload_root = tmp_path / "uploads"
    upload_root.mkdir()
    monkeypatch.setattr(avatars, "upload_root", lambda: upload_root)
    user_id = uuid.uuid4()
    path = avatars.write_avatar_bytes(user_id, b"png-bytes", ext=".png")
    assert path.is_file()
    assert path.read_bytes() == b"png-bytes"


@pytest.mark.parametrize(
    ("suffix", "expected"),
    [
        (".jpg", "image/jpeg"),
        (".jpeg", "image/jpeg"),
        (".png", "image/png"),
        (".gif", "image/gif"),
        (".webp", "image/webp"),
        (".bmp", "application/octet-stream"),
    ],
)
def test_resolve_avatar_media_type(tmp_path, suffix: str, expected: str) -> None:
    assert avatars.resolve_avatar_media_type(tmp_path / f"avatar{suffix}") == expected


def test_resolve_avatar_file_returns_none_when_missing(tmp_path, monkeypatch) -> None:
    upload_root = tmp_path / "uploads"
    upload_root.mkdir()
    monkeypatch.setattr(avatars, "upload_root", lambda: upload_root)
    assert avatars.resolve_avatar_file(uuid.uuid4()) is None


@pytest.mark.asyncio
async def test_save_user_avatar_replaces_existing(tmp_path, monkeypatch) -> None:
    upload_root = tmp_path / "uploads"
    upload_root.mkdir()
    monkeypatch.setattr(avatars, "upload_root", lambda: upload_root)

    user_id = uuid.uuid4()
    existing = avatars.avatars_dir() / f"{user_id.hex}.jpg"
    existing.parent.mkdir(parents=True, exist_ok=True)
    existing.write_bytes(b"old")

    db = AsyncMock()
    user = MagicMock()
    user.id = user_id
    upload = UploadFile(
        filename="avatar.png",
        file=BytesIO(b"new-image"),
        headers={"content-type": "image/png"},
    )

    url = await avatars.save_user_avatar(db, user, upload)
    assert url == avatars.avatar_public_path(user_id)
    assert user.avatar_url == url
    assert user.avatar_preset_id is None
    assert not existing.is_file()
    assert (avatars.avatars_dir() / f"{user_id.hex}.png").is_file()
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(user)


@pytest.mark.asyncio
async def test_save_user_avatar_rejects_empty_file() -> None:
    db = AsyncMock()
    user = MagicMock()
    user.id = uuid.uuid4()
    upload = UploadFile(
        filename="avatar.png",
        file=BytesIO(b""),
        headers={"content-type": "image/png"},
    )
    with pytest.raises(HTTPException) as exc:
        await avatars.save_user_avatar(db, user, upload)
    assert exc.value.status_code == 400
    assert "Tom fil" in exc.value.detail


@pytest.mark.asyncio
async def test_save_user_avatar_rejects_oversized_file() -> None:
    db = AsyncMock()
    user = MagicMock()
    user.id = uuid.uuid4()
    upload = UploadFile(
        filename="avatar.png",
        file=BytesIO(b"x" * (avatars.MAX_AVATAR_BYTES + 1)),
        headers={"content-type": "image/png"},
    )
    with pytest.raises(HTTPException) as exc:
        await avatars.save_user_avatar(db, user, upload)
    assert exc.value.status_code == 400
    assert "2 MB" in exc.value.detail


def test_safe_avatar_path_stays_under_avatars_dir(tmp_path, monkeypatch) -> None:
    upload_root = tmp_path / "uploads"
    upload_root.mkdir()
    monkeypatch.setattr(avatars, "upload_root", lambda: upload_root)

    user_id = uuid.uuid4()
    path = avatars._safe_avatar_path(user_id, ".png")

    assert path.is_file() is False
    assert path.resolve().is_relative_to((upload_root / "avatars").resolve())


def test_safe_avatar_path_rejects_unknown_extension() -> None:
    with pytest.raises(HTTPException) as exc:
        avatars._safe_avatar_path(uuid.uuid4(), "../secret.txt")
    assert exc.value.status_code == 400


def test_resolve_avatar_file_only_returns_paths_inside_avatars_dir(tmp_path, monkeypatch) -> None:
    upload_root = tmp_path / "uploads"
    avatars_root = upload_root / "avatars"
    avatars_root.mkdir(parents=True)

    user_id = uuid.uuid4()
    avatar_file = avatars_root / f"{user_id.hex}.jpg"
    avatar_file.write_bytes(b"fake-image")

    monkeypatch.setattr(avatars, "upload_root", lambda: upload_root)

    resolved = avatars.resolve_avatar_file(user_id)
    assert resolved == avatar_file.resolve()
    assert resolved.is_relative_to(avatars_root.resolve())
