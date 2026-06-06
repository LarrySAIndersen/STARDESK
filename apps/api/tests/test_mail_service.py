import asyncio
from unittest.mock import patch

import pytest

from star_itsm_api.core.config import settings
from star_itsm_api.services.mail import send_escalation_email


class _FakeResponse:
    def __init__(self, status_code: int, text: str = ""):
        self.status_code = status_code
        self.text = text


class _FakeAsyncClient:
    def __init__(self, *, response: _FakeResponse):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, *args, **kwargs):  # noqa: ANN002, ANN003
        await asyncio.sleep(0)
        return self._response


@pytest.mark.asyncio
async def test_send_escalation_email_skips_when_unconfigured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "resend_api_key", None)
    monkeypatch.setattr(settings, "mail_from", None)
    assert await send_escalation_email(
        to_address="ops@example.dk",
        subject="SLA brud",
        body="Ticket INC-1",
    ) is False


@pytest.mark.asyncio
async def test_send_escalation_email_success(monkeypatch: pytest.MonkeyPatch) -> None:
    import star_itsm_api.services.mail as mail_service

    monkeypatch.setattr(settings, "resend_api_key", "re_test_key")
    monkeypatch.setattr(settings, "mail_from", "desk@example.dk")
    monkeypatch.setattr(
        mail_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(response=_FakeResponse(200)),
    )
    assert await send_escalation_email(
        to_address="ops@example.dk",
        subject="SLA brud",
        body="Ticket INC-1",
    ) is True


@pytest.mark.asyncio
async def test_send_escalation_email_resend_error(monkeypatch: pytest.MonkeyPatch) -> None:
    import star_itsm_api.services.mail as mail_service

    monkeypatch.setattr(settings, "resend_api_key", "re_test_key")
    monkeypatch.setattr(settings, "mail_from", "desk@example.dk")
    monkeypatch.setattr(
        mail_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(
            response=_FakeResponse(422, text="invalid recipient"),
        ),
    )
    assert await send_escalation_email(
        to_address="bad",
        subject="SLA",
        body="body",
    ) is False
