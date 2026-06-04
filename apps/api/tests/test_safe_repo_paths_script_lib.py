import importlib.util
from pathlib import Path

import pytest

_SAFE_REPO_PATHS = (
    Path(__file__).resolve().parents[3] / "scripts" / "lib" / "safe_repo_paths.py"
)


def _load_safe_repo_paths():
    spec = importlib.util.spec_from_file_location("safe_repo_paths", _SAFE_REPO_PATHS)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_resolve_repo_file_api_env() -> None:
    mod = _load_safe_repo_paths()
    target = mod.resolve_repo_file("apps", "api", ".env")
    assert target == mod.repo_root() / "apps" / "api" / ".env"
    assert target.is_relative_to(mod.repo_root())


def test_resolve_repo_file_rejects_traversal() -> None:
    mod = _load_safe_repo_paths()
    with pytest.raises(ValueError, match="invalid path segment"):
        mod.resolve_repo_file("..", "etc", "passwd")


def test_write_text_under_repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    mod = _load_safe_repo_paths()
    monkeypatch.setattr(mod, "_REPO_ROOT", tmp_path, raising=False)
    env_dir = tmp_path / "apps" / "api"
    env_dir.mkdir(parents=True)
    env_file = mod.resolve_repo_file("apps", "api", ".env")
    mod.write_text_under_repo(env_file, "DATABASE_URL=test\n")
    assert env_file.read_text(encoding="utf-8") == "DATABASE_URL=test\n"
