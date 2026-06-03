"""Rewrite Cobertura paths from apps/api-relative to repo-root-relative for SonarCloud.

Pytest runs in apps/api and coverage.py emits filename="src/star_itsm_api/...".
Sonar sources are configured as apps/api/src at the repository root, so paths must
be apps/api/src/star_itsm_api/... or Sonar ignores the report (0% coverage).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_SRC_PREFIX = "apps/api/src/"
API_SRC_PREFIX = "src/"


def fix_coverage_xml(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    needle = f'filename="{API_SRC_PREFIX}'
    replacement = f'filename="{REPO_SRC_PREFIX}'

    if needle not in text:
        if replacement in text:
            print(f"Already Sonar-ready: {path}", file=sys.stderr)
            return 0
        print(f"No {API_SRC_PREFIX!r} paths to rewrite in {path}", file=sys.stderr)
        return 1

    count = text.count(needle)
    updated = text.replace(needle, replacement)
    updated = updated.replace("<source></source>", f"<source>{REPO_SRC_PREFIX}</source>")
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
