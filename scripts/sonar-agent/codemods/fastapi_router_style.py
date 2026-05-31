"""Sonar S8409: remove redundant response_model when return type matches."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROUTERS_DIR = Path(__file__).resolve().parents[3] / "apps" / "api" / "src" / "star_itsm_api" / "routers"

RESPONSE_MODEL_RE = re.compile(r"response_model\s*=\s*([^,\)]+)")


def _normalize_type(t: str) -> str:
    return re.sub(r"\s+", "", t.strip())


def remove_redundant_response_model(content: str) -> str:
    lines = content.splitlines(keepends=True)
    i = 0
    while i < len(lines):
        line = lines[i]
        if "@router." not in line and "@app." not in line:
            i += 1
            continue
        decorator_lines = [line]
        j = i
        while ")" not in line and j + 1 < len(lines):
            j += 1
            line = lines[j]
            decorator_lines.append(line)
        block = "".join(decorator_lines)
        rm = RESPONSE_MODEL_RE.search(block)
        if not rm:
            i = j + 1
            continue
        response_type = rm.group(1).strip()
        k = j + 1
        while k < len(lines) and not lines[k].lstrip().startswith(("async def ", "def ")):
            k += 1
        if k >= len(lines):
            i = j + 1
            continue
        sig_lines = [lines[k]]
        while "->" not in sig_lines[-1] and k + 1 < len(lines):
            k += 1
            sig_lines.append(lines[k])
        sig = "".join(sig_lines)
        ret_match = re.search(r"->\s*([^:\n]+):", sig)
        if not ret_match:
            i = j + 1
            continue
        return_type = ret_match.group(1).strip()
        if _normalize_type(response_type) != _normalize_type(return_type):
            i = j + 1
            continue
        new_block = RESPONSE_MODEL_RE.sub("", block)
        new_block = re.sub(r",\s*,", ",", new_block)
        new_block = re.sub(r"\(\s*,", "(", new_block)
        new_block = re.sub(r",\s*\)", ")", new_block)
        new_lines = new_block.splitlines(keepends=True)
        lines[i : j + 1] = new_lines
        i += len(new_lines)
    return "".join(lines)


def process_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = remove_redundant_response_model(original)
    if updated != original:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


def main() -> int:
    targets = [Path(p) for p in sys.argv[1:]] if len(sys.argv) > 1 else sorted(ROUTERS_DIR.glob("*.py"))
    changed = sum(process_file(p) for p in targets)
    print(f"done: {changed}/{len(targets)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
