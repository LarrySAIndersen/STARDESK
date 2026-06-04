"""Safe path resolution under a fixed root (Sonar S2083 mitigation)."""

import re
from pathlib import Path

from fastapi import HTTPException

from star_itsm_api.core.http_details import INVALID_FILE_PATH


def resolve_path_under_root(*, root: Path, basename: str, pattern: re.Pattern[str]) -> Path:
    """Map a validated basename to an absolute path under root."""
    matched = pattern.fullmatch(basename)
    if matched is None:
        raise HTTPException(status_code=400, detail=INVALID_FILE_PATH)
    safe = matched.group(0)
    if Path(safe).name != safe:
        raise HTTPException(status_code=400, detail=INVALID_FILE_PATH)

    storage_root = root.resolve()
    # NOSONAR pythonsecurity:S2083 — regex basename; is_relative_to guard below.
    target = storage_root.joinpath(safe).resolve()
    if not target.is_relative_to(storage_root):
        raise HTTPException(status_code=400, detail=INVALID_FILE_PATH)
    return target


def write_bytes_under_root(
    *,
    root: Path,
    basename: str,
    pattern: re.Pattern[str],
    data: bytes,
) -> Path:
    """Write bytes to root/basename after regex + prefix validation."""
    target = resolve_path_under_root(root=root, basename=basename, pattern=pattern)
    target.write_bytes(data)  # NOSONAR pythonsecurity:S2083 — target validated under root above.
    return target
