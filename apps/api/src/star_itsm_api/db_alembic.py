"""Run Alembic migrations (upgrade head) — used on API startup and in CI."""

from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config

logger = logging.getLogger(__name__)


def _alembic_ini_path() -> Path:
    # apps/api/src/star_itsm_api/db_alembic.py → apps/api/alembic.ini
    return Path(__file__).resolve().parents[2] / "alembic.ini"


def run_alembic_upgrade_head() -> None:
    """Apply all pending Alembic revisions."""
    ini = _alembic_ini_path()
    if not ini.is_file():
        raise FileNotFoundError(f"Alembic config not found: {ini}")
    cfg = Config(str(ini))
    logger.info("Running alembic upgrade head")
    command.upgrade(cfg, "head")
    logger.info("Alembic upgrade head complete")


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    run_alembic_upgrade_head()


if __name__ == "__main__":
    main()
