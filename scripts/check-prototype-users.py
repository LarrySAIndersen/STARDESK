#!/usr/bin/env python3
"""Check DB connectivity and prototype user rows. Run via vercel env run."""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import text

from star_itsm_api.core.prototype_credentials import prototype_bootstrap_password_hash
from star_itsm_api.core.security import verify_password
from star_itsm_api.db import async_session_factory

CHECK_EMAILS = (
    "larrysanders@example.dk",
    "benny.andersen@example.dk",
    "sf01@example.dk",
)


async def main() -> int:
    bootstrap = (os.environ.get("PROTOTYPE_BOOTSTRAP_PASSWORD") or "").strip()
    print(f"STARDESK_ENV={os.environ.get('STARDESK_ENV')}")
    print(f"PROTOTYPE_BOOTSTRAP_PASSWORD set={bool(bootstrap)} matches_Stardesk2026!={bootstrap == 'Stardesk2026!'}")
    if not bootstrap:
        print("ERROR: PROTOTYPE_BOOTSTRAP_PASSWORD missing")
        return 1

    expected_hash = prototype_bootstrap_password_hash()
    async with async_session_factory() as db:
        ping = (await db.execute(text("SELECT 1"))).scalar()
        print(f"DB ping={ping}")

        for email in CHECK_EMAILS:
            row = await db.execute(
                text(
                    """
                    SELECT email, is_active, deleted_at IS NOT NULL AS deleted, password_hash
                    FROM users
                    WHERE lower(email) = lower(:email)
                    """
                ),
                {"email": email},
            )
            user = row.fetchone()
            if user is None:
                print(f"{email}: NOT FOUND")
                continue
            mapping = user._mapping
            hash_ok = verify_password(bootstrap, mapping["password_hash"])
            pepper_ok = mapping["password_hash"] == expected_hash
            print(
                f"{email}: active={mapping['is_active']} deleted={mapping['deleted']} "
                f"hash_matches_password={hash_ok} hash_is_pepper_bootstrap={pepper_ok}"
            )

        lock_rows = await db.execute(
            text(
                """
                SELECT throttle_key, scope, failed_attempts, locked_until
                FROM login_throttle
                WHERE throttle_key = ANY(:emails)
                ORDER BY throttle_key, scope
                """
            ),
            {"emails": list(CHECK_EMAILS)},
        )
        locks = lock_rows.fetchall()
        print(f"login_throttle rows={len(locks)}")
        for lock in locks:
            print(dict(lock._mapping))

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
