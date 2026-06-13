"""Per-IP rate limiting and per-account lockout for /auth/login."""

from __future__ import annotations

import logging
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import DBAPIError, ProgrammingError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.config import settings
from star_itsm_api.core.demo import get_prototype_bootstrap_password
from star_itsm_api.core.security import hash_password
from star_itsm_api.models.login_throttle import SCOPE_ACCOUNT, SCOPE_IP, LoginThrottle
from star_itsm_api.models.user import User

logger = logging.getLogger(__name__)

_GENERIC_LOCKOUT = (
    "For mange forkerte login-forsøg. Kontoen er midlertidigt låst — prøv igen senere."
)
_DEMO_LOCKOUT = (
    "For mange forkerte login-forsøg. Kontoen er låst i {minutes} minutter. "
    "Demo-konti (@example.dk) er nulstillet — log ind med Stardesk2026! når lockout udløber."
)
_IP_RATE_LIMIT = (
    "For mange login-forsøg fra denne forbindelse. Vent et øjeblik og prøv igen."
)

_login_throttle_table_missing = False


def _is_login_throttle_schema_error(exc: BaseException) -> bool:
    parts = [str(exc).lower()]
    orig = getattr(exc, "orig", None)
    if orig is not None:
        parts.append(str(orig).lower())
    message = " ".join(parts)
    return "login_throttle" in message or ("does not exist" in message and "throttle" in message)


def _as_utc_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def mark_login_throttle_schema_ready() -> None:
    """Re-enable throttling after schema sync created login_throttle."""
    global _login_throttle_table_missing
    _login_throttle_table_missing = False


async def _with_login_throttle_table[T](
    db: AsyncSession,
    operation: Callable[[], Awaitable[T]],
    *,
    fallback: T,
) -> T:
    """Run throttle DB work; skip when login_throttle table is not migrated yet."""
    global _login_throttle_table_missing
    if _login_throttle_table_missing:
        return fallback
    try:
        return await operation()
    except (ProgrammingError, DBAPIError, SQLAlchemyError) as exc:
        if not _is_login_throttle_schema_error(exc):
            raise
        _login_throttle_table_missing = True
        try:
            await db.rollback()
        except SQLAlchemyError:
            logger.exception("rollback after login_throttle schema error failed")
        logger.warning("login_throttle table missing — login throttling disabled until migrated")
        return fallback


def _now() -> datetime:
    return datetime.now(UTC)


def _is_prototype_demo_email(email: str) -> bool:
    return email.lower().strip().endswith("@example.dk")


def _lockout_message(*, minutes: int, demo_account: bool) -> str:
    if demo_account:
        return _DEMO_LOCKOUT.format(minutes=minutes)
    return _GENERIC_LOCKOUT


def _ip_window() -> timedelta:
    return timedelta(minutes=settings.login_ip_window_minutes)


def _lockout_duration() -> timedelta:
    return timedelta(minutes=settings.login_lockout_minutes)


async def _get_row(
    db: AsyncSession,
    *,
    scope: str,
    throttle_key: str,
) -> LoginThrottle | None:
    async def _load() -> LoginThrottle | None:
        result = await db.execute(
            select(LoginThrottle).where(
                LoginThrottle.scope == scope,
                LoginThrottle.throttle_key == throttle_key,
            )
        )
        return result.scalar_one_or_none()

    return await _with_login_throttle_table(db, _load, fallback=None)


async def _upsert_row(db: AsyncSession, row: LoginThrottle) -> None:
    async def _save() -> None:
        row.updated_at = _now()
        db.add(row)
        await db.commit()

    await _with_login_throttle_table(db, _save, fallback=None)


async def assert_login_allowed(
    db: AsyncSession,
    email: str,
    client_ip: str,
) -> None:
    """Raise 429 when IP or account is throttled."""
    try:
        await _assert_login_allowed_impl(db, email, client_ip)
    except HTTPException:
        raise
    except Exception:
        logger.exception("login throttle check failed — allowing login attempt")
        try:
            await db.rollback()
        except SQLAlchemyError:
            logger.exception("rollback after login throttle failure failed")


async def _assert_login_allowed_impl(
    db: AsyncSession,
    email: str,
    client_ip: str,
) -> None:
    """Raise 429 when IP or account is throttled."""
    now = _now()
    ip_row = await _get_row(db, scope=SCOPE_IP, throttle_key=client_ip)
    if ip_row is not None:
        window_end = _as_utc_aware(ip_row.window_started_at) + _ip_window()
        if now < window_end and ip_row.failed_attempts >= settings.login_ip_max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=_IP_RATE_LIMIT,
            )
        if now >= window_end:
            ip_row.failed_attempts = 0
            ip_row.window_started_at = now
            await _upsert_row(db, ip_row)

    account_row = await _get_row(db, scope=SCOPE_ACCOUNT, throttle_key=email)
    if account_row is None or account_row.locked_until is None:
        return
    if _as_utc_aware(account_row.locked_until) > now:
        remaining = max(1, int((account_row.locked_until - now).total_seconds() // 60) or 1)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=_lockout_message(
                minutes=remaining,
                demo_account=_is_prototype_demo_email(email),
            ),
        )
    account_row.failed_attempts = 0
    account_row.locked_until = None
    await _upsert_row(db, account_row)


async def _increment_ip_failures(db: AsyncSession, client_ip: str) -> None:
    now = _now()
    row = await _get_row(db, scope=SCOPE_IP, throttle_key=client_ip)
    if row is None:
        row = LoginThrottle(
            id=uuid.uuid4(),
            scope=SCOPE_IP,
            throttle_key=client_ip,
            failed_attempts=1,
            window_started_at=now,
        )
        await _upsert_row(db, row)
        return
    window_end = _as_utc_aware(row.window_started_at) + _ip_window()
    if now >= window_end:
        row.failed_attempts = 1
        row.window_started_at = now
    else:
        row.failed_attempts += 1
    await _upsert_row(db, row)


async def _reset_prototype_password(db: AsyncSession, user: User) -> None:
    if not _is_prototype_demo_email(user.email):
        return
    user.password_hash = hash_password(get_prototype_bootstrap_password())
    user.must_change_password = False
    db.add(user)


async def on_login_failure(
    db: AsyncSession,
    email: str,
    client_ip: str,
    user: User | None,
) -> None:
    try:
        await _on_login_failure_impl(db, email, client_ip, user)
    except Exception:
        logger.exception("login throttle failure recording skipped")
        try:
            await db.rollback()
        except SQLAlchemyError:
            logger.exception("rollback after login failure throttle error failed")


async def _on_login_failure_impl(
    db: AsyncSession,
    email: str,
    client_ip: str,
    user: User | None,
) -> None:
    await _increment_ip_failures(db, client_ip)

    now = _now()
    row = await _get_row(db, scope=SCOPE_ACCOUNT, throttle_key=email)
    if row is None:
        row = LoginThrottle(
            id=uuid.uuid4(),
            scope=SCOPE_ACCOUNT,
            throttle_key=email,
            failed_attempts=1,
            window_started_at=now,
        )
    else:
        if row.locked_until is not None and _as_utc_aware(row.locked_until) <= now:
            row.failed_attempts = 0
            row.locked_until = None
        row.failed_attempts += 1

    if row.failed_attempts >= settings.login_account_max_failures:
        row.locked_until = now + _lockout_duration()
        if user is not None:
            await _reset_prototype_password(db, user)

    await _upsert_row(db, row)


async def on_login_success(db: AsyncSession, email: str) -> None:
    async def _clear() -> None:
        await db.execute(
            delete(LoginThrottle).where(
                LoginThrottle.scope == SCOPE_ACCOUNT,
                LoginThrottle.throttle_key == email,
            )
        )
        await db.commit()

    await _with_login_throttle_table(db, _clear, fallback=None)
