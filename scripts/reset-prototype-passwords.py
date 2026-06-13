#!/usr/bin/env python3
"""Reset @example.dk prototype password hashes to documented bootstrap password."""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import text

from star_itsm_api.core.prototype_credentials import prototype_bootstrap_password_hash
from star_itsm_api.db import async_session_factory

EXTRA_EMAILS = ("benny.andersen@example.dk",)


async def main() -> int:
    bootstrap = (os.environ.get("PROTOTYPE_BOOTSTRAP_PASSWORD") or "").strip()
    if bootstrap != "Stardesk2026!":
        print(
            f"WARN: PROTOTYPE_BOOTSTRAP_PASSWORD is not Stardesk2026! (len={len(bootstrap)}). "
            "Proceeding with env value."
        )

    demo_hash = prototype_bootstrap_password_hash()
    async with async_session_factory() as db:
        result = await db.execute(
            text(
                """
                UPDATE users
                SET password_hash = :hash,
                    is_active = TRUE,
                    deleted_at = NULL,
                    must_change_password = FALSE,
                    password_policy_exempt = TRUE,
                    updated_at = NOW()
                WHERE deleted_at IS NULL
                  AND email LIKE '%@example.dk'
                """
            ),
            {"hash": demo_hash},
        )
        updated = result.rowcount or 0

        for email in EXTRA_EMAILS:
            await db.execute(
                text(
                    """
                    INSERT INTO users (
                        id, email, display_name, role, is_active, password_hash,
                        must_change_password, password_policy_exempt, ui_mode
                    ) VALUES (
                        gen_random_uuid(), :email, :display_name, 'admin', TRUE, :hash,
                        FALSE, TRUE, 'modern'
                    )
                    ON CONFLICT (email) DO UPDATE SET
                        password_hash = EXCLUDED.password_hash,
                        is_active = TRUE,
                        deleted_at = NULL,
                        must_change_password = FALSE,
                        password_policy_exempt = TRUE,
                        updated_at = NOW()
                    """
                ),
                {
                    "email": email,
                    "display_name": email.split("@", maxsplit=1)[0].replace(".", " ").title(),
                    "hash": demo_hash,
                },
            )

        await db.commit()
        print(f"Updated {updated} @example.dk users.")

        try:
            await db.execute(
                text(
                    """
                    DELETE FROM login_throttle
                    WHERE throttle_key IN (
                        SELECT email FROM users WHERE email LIKE '%@example.dk'
                    )
                    """
                )
            )
            await db.commit()
            print("Cleared demo login lockouts.")
        except Exception as exc:
            await db.rollback()
            print(f"Skipped login_throttles cleanup: {exc}")

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
