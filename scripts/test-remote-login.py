#!/usr/bin/env python3
"""POST /api/v1/auth/login against a deployed API (no local DB)."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

DEFAULT_API = "https://api-gamma-amber.vercel.app"
PASSWORD = "Stardesk2026!"


def login(api_base: str, email: str) -> None:
    url = f"{api_base.rstrip('/')}/api/v1/auth/login"
    payload = json.dumps({"email": email, "password": PASSWORD}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            print(f"{email}: OK token_len={len(body.get('access_token', ''))}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        print(f"{email}: HTTP {exc.code} {detail[:200]}")


def main() -> int:
    api = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_API
    emails = sys.argv[2:] or [
        "larrysanders@example.dk",
        "benny.andersen@example.dk",
        "sf01@example.dk",
    ]
    print(f"API={api}")
    for email in emails:
        login(api, email)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
