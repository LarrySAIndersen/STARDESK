import json
import os
from pathlib import Path

import httpx
import pytest

pytestmark = pytest.mark.destructive


def _base_url() -> str:
    return str(
        os.getenv("DESTRUCTIVE_API_BASE_URL") or os.getenv("BASE_URL") or "http://localhost:8000"
    ).rstrip("/")


def _load_first_user() -> dict[str, str] | None:
    inline = os.getenv("LOAD_TEST_USERS")
    if inline:
        try:
            users = json.loads(inline)
            if isinstance(users, list) and users:
                first = users[0]
                if isinstance(first, dict):
                    return {
                        "email": str(first.get("email", "")).strip(),
                        "password": str(first.get("password", "")),
                    }
        except json.JSONDecodeError:
            return None

    users_file = os.getenv("LOAD_TEST_USERS_FILE", "scripts/load-test/load-test-users.json")
    path = Path(users_file)
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[4] / users_file
    if not path.exists():
        return None
    users = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(users, list) or not users:
        return None
    first = users[0]
    if not isinstance(first, dict):
        return None
    return {
        "email": str(first.get("email", "")).strip(),
        "password": str(first.get("password", "")),
    }


@pytest.fixture(scope="session")
def destructive_base_url() -> str:
    base_url = _base_url()
    if os.getenv("ALLOW_DESTRUCTIVE") != "1":
        pytest.skip("Destructive tests require ALLOW_DESTRUCTIVE=1")
    try:
        response = httpx.get(f"{base_url}/health", timeout=3.0)
    except httpx.HTTPError as exc:
        pytest.skip(f"API not reachable at {base_url}/health ({exc})")
    if response.status_code >= 500:
        pytest.skip(f"API unhealthy at {base_url}/health (status={response.status_code})")
    return base_url


@pytest.fixture(scope="session")
def auth_headers(destructive_base_url: str) -> dict[str, str]:
    user = _load_first_user()
    if not user or not user.get("email") or not user.get("password"):
        pytest.skip("No load-test user pool found for authenticated destructive checks")
    response = httpx.post(
        f"{destructive_base_url}/api/v1/auth/login",
        json={"email": user["email"], "password": user["password"]},
        timeout=5.0,
    )
    assert response.status_code == 200, (
        f"Expected login 200, got {response.status_code}: {response.text}"
    )
    token = response.json().get("access_token")
    assert token, "Login did not return access_token"
    return {"Authorization": f"Bearer {token}"}


def test_admin_route_rejects_anonymous_without_5xx(destructive_base_url: str) -> None:
    response = httpx.get(f"{destructive_base_url}/api/v1/users", timeout=5.0)
    assert response.status_code in {401, 403}
    assert response.status_code < 500


@pytest.mark.parametrize(
    "payload",
    [
        {"ticket_type": 123, "title": True, "description": []},
        {"ticket_type": "incident", "title": "a", "description": "short"},
        {"ticket_type": "incident", "title": "x" * 5000, "description": "y" * 100000},
        {"ticket_type": "invalid_type", "title": "broken payload", "description": "z" * 30},
    ],
)
def test_create_ticket_invalid_types_rejected_gracefully(
    destructive_base_url: str,
    auth_headers: dict[str, str],
    payload: dict[str, object],
) -> None:
    response = httpx.post(
        f"{destructive_base_url}/api/v1/tickets",
        headers=auth_headers,
        json=payload,
        timeout=10.0,
    )
    assert response.status_code in {400, 413, 415, 422}
    assert response.status_code < 500


def test_patch_ticket_wrong_uuid_rejected_without_5xx(
    destructive_base_url: str,
    auth_headers: dict[str, str],
) -> None:
    response = httpx.patch(
        f"{destructive_base_url}/api/v1/tickets/not-a-uuid",
        headers=auth_headers,
        json={"status": "resolved"},
        timeout=5.0,
    )
    assert response.status_code == 422
    assert response.status_code < 500
