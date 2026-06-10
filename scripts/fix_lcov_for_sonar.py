"""Rewrite Vitest LCOV paths for SonarCloud import.

Vitest emits SF:src/... relative to apps/web. Sonar indexes sources at
apps/web/src from the repo root — rewrite SF lines to match.
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from pathlib import Path

SONAR_PREFIX = "apps/web/src/"
VITEST_PREFIX = "src/"


def _load_safe_repo_paths():
    global _SAFE_REPO_PATHS_MODULE
    if _SAFE_REPO_PATHS_MODULE is not None:
        return _SAFE_REPO_PATHS_MODULE
    lib_path = Path(__file__).resolve().parent / "lib" / "safe_repo_paths.py"
    spec = importlib.util.spec_from_file_location("safe_repo_paths", lib_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load safe_repo_paths from {lib_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _SAFE_REPO_PATHS_MODULE = module
    return module


_SAFE_REPO_PATHS_MODULE = None


def resolve_lcov_path(raw: str) -> Path:
    """Map a repo-relative CLI path to an absolute file under the repository root."""
    safe_repo_paths = _load_safe_repo_paths()
    normalized = raw.replace("\\", "/").strip().lstrip("/")
    if not normalized:
        raise ValueError("empty path")
    parts = normalized.split("/")
    target = safe_repo_paths.resolve_repo_file(*parts)
    if not target.is_file():
        raise FileNotFoundError(target)
    return target


def fix_lcov(path: Path) -> int:
    safe_repo_paths = _load_safe_repo_paths()
    root = safe_repo_paths.repo_root()
    resolved = path.resolve()
    if not resolved.is_relative_to(root):
        raise ValueError(f"refusing to read outside repository root: {resolved}")

    text = resolved.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    count = 0
    out: list[str] = []

    sf_re = re.compile(r"^SF:(.+)$")

    for line in lines:
        match = sf_re.match(line.rstrip("\r\n"))
        if not match:
            out.append(line)
            continue

        raw = match.group(1).replace("\\", "/")
        if raw.startswith(SONAR_PREFIX):
            out.append(line)
            continue
        if raw.startswith(VITEST_PREFIX):
            fixed = SONAR_PREFIX + raw[len(VITEST_PREFIX) :]
            out.append(f"SF:{fixed}\n")
            count += 1
            continue

        out.append(line)

    if count == 0:
        if any(f"SF:{SONAR_PREFIX}" in ln for ln in out):
            print(f"Already Sonar-ready: {resolved}", file=sys.stderr)
            return 0
        print(f"No {VITEST_PREFIX!r} paths to rewrite in {resolved}", file=sys.stderr)
        return 1

    safe_repo_paths.write_text_under_repo(resolved, "".join(out))
    print(f"Rewrote {count} file path(s) in {resolved}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "lcov",
        nargs="?",
        default="apps/web/coverage/lcov.info",
        help="Path to LCOV report (default: apps/web/coverage/lcov.info)",
    )
    args = parser.parse_args()
    try:
        path = resolve_lcov_path(args.lcov)
    except ValueError as exc:
        print(f"Invalid LCOV path: {exc}", file=sys.stderr)
        return 1
    except FileNotFoundError as exc:
        print(f"Missing LCOV report: {exc}", file=sys.stderr)
        return 1
    return fix_lcov(path)


if __name__ == "__main__":
    raise SystemExit(main())
