#!/usr/bin/env python3
"""Replace SimpleNamespace user/ticket stubs in tests flagged by Sonar S5655."""

from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
TESTS = REPO / "apps" / "api" / "tests"

TARGETS = [
    "test_kanban.py",
    "test_sf_chat_bot.py",
    "test_ticket_privacy.py",
    "test_ticket_security.py",
    "test_sla_settings.py",
    "test_sla.py",
    "test_ticket_timestamps.py",
    "test_ticket_notifications.py",
    "test_knowledge_articles.py",
    "test_prototype_staff_bootstrap.py",
    "test_top_admin_policy.py",
]

USER_FIELDS = frozenset({"id", "role", "email", "display_name", "organization_id"})
TICKET_FIELDS = frozenset(
    {
        "id",
        "ticket_number",
        "title",
        "status",
        "priority",
        "source",
        "is_major",
        "assigned_team_id",
        "resolution_due_at",
        "response_due_at",
        "sla_paused_at",
        "sla_pause_total_seconds",
        "created_at",
        "reporter_user_id",
        "is_security_ticket",
        "ticket_type",
        "description",
    }
)

USER_PAT = re.compile(
    r"SimpleNamespace\(\s*(?:id=([^,\)]+),\s*)?role=\"([^\"]+)\"\s*\)"
)
TICKET_PAT = re.compile(
    r"SimpleNamespace\(\s*((?:\w+\s*=\s*[^,\)]+(?:,\s*)?)+)\s*\)",
    re.MULTILINE,
)


def _parse_kwargs(raw: str) -> dict[str, str]:
    pairs: dict[str, str] = {}
    for part in re.findall(r"(\w+)\s*=\s*([^,\)]+?)(?:,\s*|$)", raw):
        pairs[part[0].strip()] = part[1].strip()
    return pairs


def _classify_stub(raw: str) -> str | None:
    kwargs = _parse_kwargs(raw)
    keys = set(kwargs)
    if "role" in keys and keys <= USER_FIELDS:
        return "user"
    if keys & TICKET_FIELDS:
        return "ticket"
    return None


def _format_call(name: str, kwargs: dict[str, str]) -> str:
    if name == "make_test_user":
        if "id" in kwargs:
            return f'make_test_user(user_id={kwargs["id"]}, role={kwargs["role"]})'
        return f'make_test_user(role={kwargs["role"]})'
    args = ", ".join(f"{key}={value}" for key, value in kwargs.items())
    return f"make_test_ticket({args})"


def ensure_imports(text: str, needs_user: bool, needs_ticket: bool) -> str:
    imports: list[str] = []
    if needs_user and "make_test_user" not in text:
        imports.append("from tests.support.users import make_test_user")
    if needs_ticket and "make_test_ticket" not in text:
        imports.append("from tests.support.tickets import make_test_ticket")
    if not imports:
        return text
    block = "\n".join(imports) + "\n"
    if "from types import SimpleNamespace" in text and "SimpleNamespace(" not in text.replace(
        block, ""
    ):
        text = text.replace("from types import SimpleNamespace\n", "")
    if "from types import SimpleNamespace" in text:
        return text.replace("from types import SimpleNamespace\n", block)
    return block + text


def process_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text

    def user_repl(match: re.Match[str]) -> str:
        uid, role = match.group(1), match.group(2)
        if uid:
            return f'make_test_user(user_id={uid}, role="{role}")'
        return f'make_test_user(role="{role}")'

    text = USER_PAT.sub(user_repl, text)

    def ticket_repl(match: re.Match[str]) -> str:
        raw = match.group(1)
        kind = _classify_stub(raw)
        if kind != "ticket":
            return match.group(0)
        kwargs = _parse_kwargs(raw)
        return _format_call("make_test_ticket", kwargs)

    text = TICKET_PAT.sub(ticket_repl, text)

    needs_user = "make_test_user" in text
    needs_ticket = "make_test_ticket" in text
    text = ensure_imports(text, needs_user, needs_ticket)

    if text != original:
        path.write_text(text, encoding="utf-8")
        print(f"updated {path.name}")
        return True
    return False


def main() -> None:
    count = 0
    for name in TARGETS:
        path = TESTS / name
        if path.is_file() and process_file(path):
            count += 1
    print(f"Done — {count} file(s)")


if __name__ == "__main__":
    main()
