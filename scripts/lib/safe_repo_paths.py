"""Resolve fixed files under the STARDESK repository root (Sonar S2083)."""

from __future__ import annotations

from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]


def repo_root() -> Path:
    return _REPO_ROOT.resolve()


def resolve_repo_file(*parts: str) -> Path:
    """Map constant path segments to an absolute path under the repo root."""
    if not parts:
        raise ValueError("path parts required")
    if any(part in ("", ".", "..") for part in parts):
        raise ValueError("invalid path segment")

    root = repo_root()
    target = root.joinpath(*parts).resolve()
    if not target.is_relative_to(root):
        raise ValueError(f"path escapes repository root: {target}")
    return target


def write_text_under_repo(path: Path, content: str) -> None:
    """Write text only when path is under repo_root (validated)."""
    root = repo_root()
    resolved = path.resolve()
    if not resolved.is_relative_to(root):
        raise ValueError(f"refusing to write outside repository root: {resolved}")
    resolved.write_text(content, encoding="utf-8")
