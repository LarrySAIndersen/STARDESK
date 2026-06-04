import sys
from pathlib import Path

import pytest

_SCRIPTS = Path(__file__).resolve().parents[3] / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from lib.safe_repo_paths import repo_root, resolve_repo_file, write_text_under_repo


def test_resolve_repo_file_api_env() -> None:
    target = resolve_repo_file("apps", "api", ".env")
    assert target == repo_root() / "apps" / "api" / ".env"
    assert target.is_relative_to(repo_root())


def test_resolve_repo_file_rejects_traversal() -> None:
    with pytest.raises(ValueError, match="invalid path segment"):
        resolve_repo_file("..", "etc", "passwd")


def test_write_text_under_repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "lib.safe_repo_paths._REPO_ROOT",
        tmp_path,
        raising=False,
    )
    env_dir = tmp_path / "apps" / "api"
    env_dir.mkdir(parents=True)
    env_file = resolve_repo_file("apps", "api", ".env")
    write_text_under_repo(env_file, "DATABASE_URL=test\n")
    assert env_file.read_text(encoding="utf-8") == "DATABASE_URL=test\n"
