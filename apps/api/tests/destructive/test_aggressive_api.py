import asyncio
import json
import os
from pathlib import Path
from typing import Any

import httpx
import pytest

pytestmark = pytest.mark.destructive


def _base_url() -> str:
    return str(
        os.getenv("DESTRUCTIVE_API_BASE_URL")
        or os.getenv("BASE_URL")
        or "http://127.0.0.1:8000"
    ).rstrip("/")


def _load_users() -> list[dict[str, str]]:
    inline = os.getenv("LOAD_TEST_USERS")
    if inline:
        try:
            parsed = json.loads(inline)
        except json.JSONDecodeError:
            return []
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
        return []

    users_file = os.getenv("LOAD_TEST_USERS_FILE", "scripts/load-test/load-test-users.json")
    path = Path(users_file)
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[4] / users_file
    if not path.exists():
        return []
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    if isinstance(parsed, list):
        return [item for item in parsed if isinstance(item, dict)]
    return []


@pytest.fixture(scope="session")
def destructive_base_url() -> str:
    if os.getenv("ALLOW_DESTRUCTIVE") != "1":
        pytest.skip("Aggressive destructive tests require ALLOW_DESTRUCTIVE=1")
    base_url = _base_url()
    try:
        response = httpx.get(f"{base_url}/health", timeout=3.0)
    except httpx.HTTPError as exc:
        pytest.skip(f"API not reachable at {base_url}/health ({exc})")
    if response.status_code >= 500:
        pytest.skip(f"API unhealthy at {base_url}/health (status={response.status_code})")
    return base_url


def _login(base_url: str, email: str, password: str) -> tuple[str | None, str | None]:
    response = httpx.post(
        f"{base_url}/api/v1/auth/login",
        json={"email": email, "password": password},
        timeout=5.0,
    )
    if response.status_code != 200:
        return None, None
    body = response.json()
    token = body.get("access_token")
    role = body.get("user", {}).get("role")
    if not token:
        return None, None
    return str(token), str(role) if role else None


@pytest.fixture(scope="session")
def auth_context(destructive_base_url: str) -> dict[str, str]:
    users = _load_users()
    if not users:
        pytest.skip("No user pool found for aggressive destructive authentication")

    staff_token: str | None = None
    submitter_token: str | None = None
    for user in users:
        email = str(user.get("email", "")).strip()
        password = str(user.get("password", ""))
        if not email or not password:
            continue
        token, role = _login(destructive_base_url, email, password)
        if not token:
            continue
        if staff_token is None and role in {"top_admin", "admin", "agent"}:
            staff_token = token
        if submitter_token is None and role in {"submitter", "end_user"}:
            submitter_token = token
        if staff_token and submitter_token:
            break

    if not staff_token:
        pytest.skip("No staff credentials available in load-test users for aggressive tests")

    return {"staff_token": staff_token, "submitter_token": submitter_token or ""}


def _auth_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _create_ticket(base_url: str, token: str, title_suffix: str) -> str:
    response = httpx.post(
        f"{base_url}/api/v1/tickets",
        headers=_auth_headers(token),
        json={
            "ticket_type": "incident",
            "title": f"aggressive-destructive-{title_suffix}",
            "description": "Aggressive destructive test ticket for targeted mutation race scenarios.",
            "priority": "medium",
            "gdpr_consent": False,
        },
        timeout=10.0,
    )
    assert response.status_code == 201, response.text
    ticket_id = response.json().get("id")
    assert ticket_id
    return str(ticket_id)


def test_double_promote_ticket_to_knowledge(
    destructive_base_url: str,
    auth_context: dict[str, str],
) -> None:
    ticket_id = _create_ticket(destructive_base_url, auth_context["staff_token"], "double-promote")
    payload = {"knowledge_status": "draft", "knowledge_visibility": "external"}
    first = httpx.post(
        f"{destructive_base_url}/api/v1/knowledge-articles/promote/{ticket_id}",
        headers=_auth_headers(auth_context["staff_token"]),
        json=payload,
        timeout=10.0,
    )
    second = httpx.post(
        f"{destructive_base_url}/api/v1/knowledge-articles/promote/{ticket_id}",
        headers=_auth_headers(auth_context["staff_token"]),
        json=payload,
        timeout=10.0,
    )
    assert first.status_code == 200
    assert second.status_code in {400, 409, 422}
    assert second.status_code < 500


def test_slack_push_twice_same_ticket_no_5xx(
    destructive_base_url: str,
    auth_context: dict[str, str],
) -> None:
    ticket_id = _create_ticket(destructive_base_url, auth_context["staff_token"], "slack-push")
    payload = {"channel_id": "C_MOCK_IT_SUPPORT"}
    first = httpx.post(
        f"{destructive_base_url}/api/v1/tickets/{ticket_id}/slack-push",
        headers=_auth_headers(auth_context["staff_token"]),
        json=payload,
        timeout=10.0,
    )
    second = httpx.post(
        f"{destructive_base_url}/api/v1/tickets/{ticket_id}/slack-push",
        headers=_auth_headers(auth_context["staff_token"]),
        json=payload,
        timeout=10.0,
    )
    assert first.status_code == 200
    assert second.status_code in {200, 400, 409, 422}
    assert second.status_code < 500


def test_assign_while_closing_parallel_no_5xx(
    destructive_base_url: str,
    auth_context: dict[str, str],
) -> None:
    ticket_id = _create_ticket(destructive_base_url, auth_context["staff_token"], "assign-close-race")
    headers = _auth_headers(auth_context["staff_token"])

    async def _run_parallel() -> tuple[httpx.Response, httpx.Response]:
        async with httpx.AsyncClient(base_url=destructive_base_url, timeout=10.0) as client:
            close_req = client.patch(f"/api/v1/tickets/{ticket_id}", headers=headers, json={"status": "closed"})
            assign_req = client.patch(
                f"/api/v1/tickets/{ticket_id}/assignment",
                headers=headers,
                json={"assignment_reason": "aggressive-race-assignment"},
            )
            close_res, assign_res = await asyncio.gather(close_req, assign_req)
            return close_res, assign_res

    close_res, assign_res = asyncio.run(_run_parallel())
    for response in (close_res, assign_res):
        assert response.status_code in {200, 400, 409, 422}
        assert response.status_code < 500


def test_list_scope_path_traversal_param_rejected(
    destructive_base_url: str,
    auth_context: dict[str, str],
) -> None:
    response = httpx.get(
        f"{destructive_base_url}/api/v1/tickets",
        headers=_auth_headers(auth_context["staff_token"]),
        params={"scope": "../../etc", "limit": "50"},
        timeout=10.0,
    )
    assert response.status_code == 400
    assert response.status_code < 500


@pytest.mark.parametrize(
    "query",
    [
        "' OR 1=1 --",
        "\"; DROP TABLE tickets; --",
        "union select * from users",
    ],
)
def test_list_search_sqlish_query_never_5xx(
    destructive_base_url: str,
    auth_context: dict[str, str],
    query: str,
) -> None:
    response = httpx.get(
        f"{destructive_base_url}/api/v1/tickets",
        headers=_auth_headers(auth_context["staff_token"]),
        params={"q": query, "limit": 25},
        timeout=10.0,
    )
    assert response.status_code in {200, 400, 422}
    assert response.status_code < 500


def test_submitter_token_cannot_hit_admin_route(
    destructive_base_url: str,
    auth_context: dict[str, str],
) -> None:
    submitter_token = auth_context.get("submitter_token") or ""
    if not submitter_token:
        pytest.skip("No submitter/end-user credentials available for authz probe test")
    response = httpx.get(
        f"{destructive_base_url}/api/v1/users",
        headers=_auth_headers(submitter_token),
        timeout=10.0,
    )
    assert response.status_code in {401, 403}
    assert response.status_code < 500
