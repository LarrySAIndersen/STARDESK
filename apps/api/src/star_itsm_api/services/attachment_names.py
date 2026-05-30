"""Stored filenames for ticket attachments."""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path


def build_attachment_filename(
    *,
    ticket_number: str,
    created_at: datetime,
    original_filename: str,
) -> str:
    """INC-1234-20260530-220301.png style names for case attachments."""
    ext = Path(original_filename).suffix.lower()
    if not ext:
        ext = ".bin"
    safe_number = re.sub(r"[^\w-]+", "-", ticket_number.strip()).strip("-") or "sag"
    stamp = created_at.strftime("%Y%m%d-%H%M%S")
    return f"{safe_number}-{stamp}{ext}"
