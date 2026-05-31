import uuid

import pytest
from fastapi import HTTPException

from star_itsm_api.services import avatars


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
