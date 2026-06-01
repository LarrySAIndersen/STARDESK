#!/usr/bin/env python3
"""Replace duplicated HTTP detail literals with http_details constants."""

from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
API_ROOT = REPO / "apps" / "api" / "src" / "star_itsm_api"

REPLACEMENTS = {
    "Insufficient permissions": "INSUFFICIENT_PERMISSIONS",
    "Ticket not found": "TICKET_NOT_FOUND",
    "User not found": "USER_NOT_FOUND",
    "Board not found": "BOARD_NOT_FOUND",
    "Not found": "NOT_FOUND",
    "Column not found": "COLUMN_NOT_FOUND",
    "Group not found": "GROUP_NOT_FOUND",
    "Chat ikke fundet": "CHAT_NOT_FOUND",
    "Opgave ikke fundet": "TASK_NOT_FOUND",
    "Ugyldig filsti": "INVALID_FILE_PATH",
    "Mindst én rettighedsgruppe er påkrævet": "MIN_ONE_GROUP_REQUIRED",
    "Ugyldig gruppe": "INVALID_GROUP",
}

SKIP = {"http_details.py"}


def merge_import(text: str, names: set[str]) -> str:
    if not names:
        return text
    existing = re.search(
        r"from star_itsm_api\.core\.http_details import \(([\s\S]*?)\)",
        text,
    )
    if existing:
        block = existing.group(1)
        current = {line.strip().rstrip(",") for line in block.splitlines() if line.strip()}
        merged = sorted(current | names)
        new_block = "from star_itsm_api.core.http_details import (\n" + ",\n".join(
            f"    {n}" for n in merged
        ) + "\n)\n"
        return text[: existing.start()] + new_block + text[existing.end() :]
    block = "from star_itsm_api.core.http_details import (\n" + ",\n".join(
        f"    {n}" for n in sorted(names)
    ) + "\n)\n"
    lines = text.splitlines(keepends=True)
    insert_at = 0
    if lines and lines[0].startswith('"""'):
        for i, line in enumerate(lines[1:], 1):
            if line.strip().endswith('"""'):
                insert_at = i + 1
                break
    while insert_at < len(lines) and lines[insert_at].startswith("from __future__"):
        insert_at += 1
    while insert_at < len(lines) and (
        lines[insert_at].startswith("import ")
        or lines[insert_at].startswith("from ")
    ):
        insert_at += 1
    return "".join(lines[:insert_at]) + block + "".join(lines[insert_at:])


def process_file(path: Path) -> bool:
    if path.name in SKIP:
        return False
    text = path.read_text(encoding="utf-8")
    used: set[str] = set()
    new = text
    for literal, const in REPLACEMENTS.items():
        pattern = re.compile(rf'detail\s*=\s*"{re.escape(literal)}"')
        if pattern.search(new):
            new = pattern.sub(f"detail={const}", new)
            used.add(const)
    if new == text:
        return False
    new = merge_import(new, used)
    path.write_text(new, encoding="utf-8")
    print(f"updated {path.relative_to(REPO)}")
    return True


def main() -> None:
    count = 0
    for path in API_ROOT.rglob("*.py"):
        if process_file(path):
            count += 1
    print(f"Done — {count} file(s)")


if __name__ == "__main__":
    main()
