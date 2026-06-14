"""Unit tests for core.security helpers and auth dependencies."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from star_itsm_api.core.config import settings
from star_itsm_api.core.security import (
    ROLE_ADMIN,
    ROLE_AGENT,
    create_access_token,
    decode_access_token,
    get_current_user,
    get_current_user_session,
    get_user_by_email,
    hash_prototype_password,
    require_admin_session,
    require_roles,
    verify_password,
)


@pytest.fixture
def jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", "test-jwt-secret-for-security-core-tests")


def test_verify_password_handles_missing_and_invalid_hash() -> None:
    assert verify_password("secret", None) is False
    assert verify_password("secret", "not-a-bcrypt-hash") is False


def test_hash_prototype_password_is_deterministic() -> None:
    first = hash_prototype_password("Stardesk2026!", pepper="default")
    second = hash_prototype_password("Stardesk2026!", pepper="default")
    assert first == second
    assert verify_password("Stardesk2026!", first)


def test_create_access_token_requires_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", None)
    with pytest.raises(HTTPException) as exc:
        create_access_token(
            user_id=uuid.uuid4(),
            role=ROLE_AGENT,
            email="agent@example.dk",
        )
    assert exc.value.status_code == 503


def test_decode_access_token_rejects_invalid_token(jwt_secret: None) -> None:
    with pytest.raises(HTTPException) as exc:
        decode_access_token("not.a.jwt")
    assert exc.value.status_code == 401


def test_decode_access_token_requires_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", None)
    with pytest.raises(HTTPException) as exc:
        decode_access_token("anything")
    assert exc.value.status_code == 503


def test_get_current_user_allows_get_with_must_change_password() -> None:
    user = SimpleNamespace(must_change_password=True, password_policy_exempt=False)
    request = MagicMock(method="GET")
    assert get_current_user(request, user) is user


def test_get_current_user_blocks_mutations_until_password_changed() -> None:
    user = SimpleNamespace(must_change_password=True, password_policy_exempt=False)
    request = MagicMock(method="POST")
    with pytest.raises(HTTPException) as exc:
        get_current_user(request, user)
    assert exc.value.status_code == 403
    assert exc.value.detail == "must_change_password"


@pytest.mark.asyncio
async def test_get_current_user_session_requires_bearer(jwt_secret: None) -> None:
    with pytest.raises(HTTPException) as exc:
        await get_current_user_session(None, AsyncMock())
    assert exc.value.status_code == 401

    creds = HTTPAuthorizationCredentials(scheme="Basic", credentials="token")
    with pytest.raises(HTTPException) as exc:
        await get_current_user_session(creds, AsyncMock())
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_session_loads_active_user(jwt_secret: None) -> None:
    user_id = uuid.uuid4()
    token = create_access_token(
        user_id=user_id,
        role=ROLE_ADMIN,
        email="admin@example.dk",
    )
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    user = SimpleNamespace(
        id=user_id,
        is_active=True,
        deleted_at=None,
    )
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=user)

    with patch(
        "star_itsm_api.core.security.ensure_user_roles_loaded",
        new_callable=AsyncMock,
    ):
        loaded = await get_current_user_session(creds, mock_db)

    assert loaded is user


@pytest.mark.asyncio
async def test_get_current_user_session_rejects_token_without_sub(jwt_secret: None) -> None:
    token = jwt.encode(
        {"role": ROLE_ADMIN, "email": "no-sub@example.dk"},
        settings.jwt_secret,
        algorithm="HS256",
    )
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with pytest.raises(HTTPException) as exc:
        await get_current_user_session(creds, AsyncMock())
    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid token"


@pytest.mark.asyncio
async def test_get_current_user_session_rejects_missing_user(jwt_secret: None) -> None:
    token = create_access_token(
        user_id=uuid.uuid4(),
        role=ROLE_ADMIN,
        email="ghost@example.dk",
    )
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc:
        await get_current_user_session(creds, mock_db)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_session_rejects_inactive_user(jwt_secret: None) -> None:
    user_id = uuid.uuid4()
    token = create_access_token(
        user_id=user_id,
        role=ROLE_ADMIN,
        email="inactive@example.dk",
    )
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    user = SimpleNamespace(id=user_id, is_active=False, deleted_at=None)
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=user)

    with pytest.raises(HTTPException) as exc:
        await get_current_user_session(creds, mock_db)
    assert exc.value.status_code == 401


def test_require_roles_blocks_unauthorized_user() -> None:
    checker = require_roles(ROLE_ADMIN)
    user = SimpleNamespace()
    with patch("star_itsm_api.core.security.user_role_set", return_value=frozenset({ROLE_AGENT})):
        with pytest.raises(HTTPException) as exc:
            checker(user)
        assert exc.value.status_code == 403


def test_require_admin_session_allows_admin() -> None:
    checker = require_admin_session()
    user = SimpleNamespace()
    with patch(
        "star_itsm_api.core.security.user_has_any_role",
        return_value=True,
    ):
        assert checker(user) is user


@pytest.mark.asyncio
async def test_get_user_by_email_normalizes_and_filters() -> None:
    mock_db = AsyncMock()
    user = SimpleNamespace(email="agent@example.dk")
    result = MagicMock()
    result.scalar_one_or_none.return_value = user
    mock_db.execute = AsyncMock(return_value=result)

    found = await get_user_by_email(mock_db, "  Agent@Example.dk  ")
    assert found is user
    mock_db.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_user_by_email_any_state_includes_inactive() -> None:
    from star_itsm_api.core.security import get_user_by_email_any_state

    mock_db = AsyncMock()
    user = SimpleNamespace(email="agent@example.dk", deleted_at="2026-01-01")
    result = MagicMock()
    result.scalar_one_or_none.return_value = user
    mock_db.execute = AsyncMock(return_value=result)

    found = await get_user_by_email_any_state(mock_db, "agent@example.dk")
    assert found is user
    mock_db.execute.assert_awaited_once()


def test_require_roles_allows_matching_user() -> None:
    checker = require_roles(ROLE_ADMIN)
    user = SimpleNamespace()
    with patch("star_itsm_api.core.security.user_role_set", return_value=frozenset({ROLE_ADMIN})):
        assert checker(user) is user


def test_create_and_decode_access_token_roundtrip(jwt_secret: None) -> None:
    user_id = uuid.uuid4()
    token = create_access_token(
        user_id=user_id,
        role=ROLE_AGENT,
        email="agent@example.dk",
        must_change_password=True,
    )
    claims = decode_access_token(token)
    assert claims["sub"] == str(user_id)
    assert claims["must_change_password"] is True
    assert jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])["email"] == "agent@example.dk"


def test_hash_password_roundtrip() -> None:
    from star_itsm_api.core.security import hash_password

    hashed = hash_password("secret-password")
    assert verify_password("secret-password", hashed)
    assert not verify_password("wrong-password", hashed)

