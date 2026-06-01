import re
from pathlib import Path

import pytest
from fastapi import HTTPException

from star_itsm_api.services.safe_paths import resolve_path_under_root, write_bytes_under_root

_OBJECT_RE = re.compile(r"^[a-z0-9]{8}\.txt$")


def test_resolve_path_under_root_happy_path(tmp_path: Path) -> None:
    root = tmp_path / "storage"
    root.mkdir()
    target = resolve_path_under_root(root=root, basename="abcd1234.txt", pattern=_OBJECT_RE)
    assert target == (root / "abcd1234.txt").resolve()


def test_resolve_path_under_root_rejects_invalid_pattern(tmp_path: Path) -> None:
    root = tmp_path / "storage"
    with pytest.raises(HTTPException) as exc:
        resolve_path_under_root(root=root, basename="../escape.txt", pattern=_OBJECT_RE)
    assert exc.value.status_code == 400
    assert exc.value.detail == "Ugyldig filsti"


def test_resolve_path_under_root_rejects_traversal_basename(tmp_path: Path) -> None:
    root = tmp_path / "storage"
    root.mkdir()
    with pytest.raises(HTTPException) as exc:
        resolve_path_under_root(
            root=root,
            basename="foo/bar.txt",
            pattern=re.compile(r"^foo/bar\.txt$"),
        )
    assert exc.value.status_code == 400


def test_write_bytes_under_root_creates_file(tmp_path: Path) -> None:
    root = tmp_path / "storage"
    root.mkdir()
    written = write_bytes_under_root(
        root=root,
        basename="deadbeef.txt",
        pattern=_OBJECT_RE,
        data=b"hello",
    )
    assert written.read_bytes() == b"hello"
    assert written.is_relative_to(root.resolve())
