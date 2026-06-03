"""Rewrite Cobertura paths for SonarCloud import.

Pytest runs in apps/api and coverage.py emits filename="src/star_itsm_api/...".
Sonar indexes Python sources under apps/api/src at the repo root. Cobertura
resolves paths as <source> + filename, so we set source to apps/api/src and
strip the leading src/ from each filename — not the full repo path in both.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SONAR_SOURCE = "apps/api/src"
PYTEST_SRC_PREFIX = "src/"
LEGACY_REPO_PREFIX = "apps/api/src/"


def _normalize_sources(text: str) -> str:
    """Ensure a single Cobertura source root for Sonar resolution."""
    text = re.sub(
        r"<sources>\s*<source>[^<]*</source>\s*</sources>",
        f"<sources>\n\t\t<source>{SONAR_SOURCE}</source>\n\t</sources>",
        text,
        count=1,
    )
    return text


def fix_coverage_xml(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    count = 0

    # Undo prior broken rewrite (full repo path in filename + source).
    legacy_needle = f'filename="{LEGACY_REPO_PREFIX}'
    if legacy_needle in text:
        legacy_count = text.count(legacy_needle)
        text = text.replace(legacy_needle, 'filename="')
        count += legacy_count

    pytest_needle = f'filename="{PYTEST_SRC_PREFIX}'
    if pytest_needle in text:
        pytest_count = text.count(pytest_needle)
        text = text.replace(pytest_needle, 'filename="')
        count += pytest_count

    if count == 0:
        if f"<source>{SONAR_SOURCE}</source>" in text and legacy_needle not in text:
            print(f"Already Sonar-ready: {path}", file=sys.stderr)
            return 0
        print(
            f"No {PYTEST_SRC_PREFIX!r} or {LEGACY_REPO_PREFIX!r} paths to rewrite in {path}",
            file=sys.stderr,
        )
        return 1

    updated = _normalize_sources(text)
    path.write_text(updated, encoding="utf-8", newline="\n")
    print(f"Rewrote {count} file path(s) in {path}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "coverage_xml",
        nargs="?",
        default="apps/api/coverage.xml",
        help="Path to Cobertura XML (default: apps/api/coverage.xml)",
    )
    args = parser.parse_args()
    path = Path(args.coverage_xml)
    if not path.is_file():
        print(f"Missing coverage report: {path}", file=sys.stderr)
        return 1
    return fix_coverage_xml(path)


if __name__ == "__main__":
    raise SystemExit(main())
