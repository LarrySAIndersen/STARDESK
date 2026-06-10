import importlib.util
from pathlib import Path

import pytest

_FIX_LCOV = Path(__file__).resolve().parents[3] / "scripts" / "fix_lcov_for_sonar.py"


def _load_fix_lcov():
    spec = importlib.util.spec_from_file_location("fix_lcov_for_sonar", _FIX_LCOV)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_resolve_lcov_path_rejects_traversal(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    mod = _load_fix_lcov()
    safe_repo_paths = mod._load_safe_repo_paths()
    monkeypatch.setattr(safe_repo_paths, "_REPO_ROOT", tmp_path, raising=False)
    with pytest.raises(ValueError, match="invalid path segment"):
        mod.resolve_lcov_path("../etc/passwd")


def test_fix_lcov_rewrites_vitest_paths(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    mod = _load_fix_lcov()
    safe_repo_paths = mod._load_safe_repo_paths()
    monkeypatch.setattr(safe_repo_paths, "_REPO_ROOT", tmp_path, raising=False)
    mod._SAFE_REPO_PATHS_MODULE = safe_repo_paths

    lcov = safe_repo_paths.resolve_repo_file("apps", "web", "coverage", "lcov.info")
    lcov.parent.mkdir(parents=True)
    lcov.write_text(
        "TN:\nSF:src/lib/api.ts\nDA:1,1\nend_of_record\n",
        encoding="utf-8",
        newline="\n",
    )

    assert mod.fix_lcov(lcov) == 0
    updated = lcov.read_text(encoding="utf-8")
    assert "SF:apps/web/src/lib/api.ts" in updated


def test_fix_lcov_rejects_path_outside_repo(tmp_path: Path) -> None:
    mod = _load_fix_lcov()
    outside = tmp_path / "outside.info"
    outside.write_text("TN:\n", encoding="utf-8")
    with pytest.raises(ValueError, match="refusing to read outside"):
        mod.fix_lcov(outside)
