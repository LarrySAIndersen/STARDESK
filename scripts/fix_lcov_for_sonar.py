"""Rewrite Vitest LCOV paths for SonarCloud import.

Vitest emits SF:src/... relative to apps/web. Sonar indexes sources at
apps/web/src from the repo root — rewrite SF lines to match.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SONAR_PREFIX = "apps/web/src/"
VITEST_PREFIX = "src/"


def fix_lcov(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
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
            print(f"Already Sonar-ready: {path}", file=sys.stderr)
            return 0
        print(f"No {VITEST_PREFIX!r} paths to rewrite in {path}", file=sys.stderr)
        return 1

    path.write_text("".join(out), encoding="utf-8", newline="\n")
    print(f"Rewrote {count} file path(s) in {path}")
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
    path = Path(args.lcov)
    if not path.is_file():
        print(f"Missing LCOV report: {path}", file=sys.stderr)
        return 1
    return fix_lcov(path)


if __name__ == "__main__":
    raise SystemExit(main())
