#!/usr/bin/env python3
"""Load and validate external health check targets.

This module provides safe URL validation to prevent ReDoS attacks
(CWE-1333) when processing user-supplied health check endpoints.
"""

import re
from typing import Optional

# Safe linear-time URL regex (no nested quantifiers on overlapping classes)
# Replaces vulnerable pattern: ([a-zA-Z0-9-]+\.)+
SAFE_URL_RE = re.compile(
    r"^(https?://)?([a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})(/.*)?$"
)


def is_valid_health_check_url(url: str) -> bool:
    """Validate a health check target URL.

    Args:
        url: URL string to validate

    Returns:
        True if URL is structurally valid and safe to use
    """
    if not url or len(url) > 2048:
        return False
    return bool(SAFE_URL_RE.match(url))


def load_registry(path: str) -> list[dict]:
    """Load health check registry from file.

    Each line should contain a valid URL. Invalid entries are skipped
    with a warning (never raise on malformed input).
    """
    registry: list[dict] = []
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                url = line.strip()
                if not url or url.startswith("#"):
                    continue
                if is_valid_health_check_url(url):
                    registry.append({"url": url, "valid": True})
                else:
                    # Log warning in production; skip silently in dev
                    print(f"Skipping invalid health check URL: {url[:64]}...")
    except FileNotFoundError:
        pass
    return registry


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python load-health-check-registry.py <registry.txt>")
        sys.exit(1)

    entries = load_registry(sys.argv[1])
    print(f"Loaded {len(entries)} valid health check targets")
