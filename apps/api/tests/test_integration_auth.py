import pytest
from fastapi import HTTPException

from star_itsm_api.core.config import settings
from star_itsm_api.core.integration_auth import verify_integration_secret


def test_open_when_not_production_and_no_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "cron_secret", None)
    verify_integration_secret(
        configured_secret=None,
        provided=None,
        integration_name="CRON_SECRET",
    )


def test_rejects_when_production_without_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "cron_secret", None)
    with pytest.raises(HTTPException) as exc:
        verify_integration_secret(
            configured_secret=None,
            provided=None,
            integration_name="CRON_SECRET",
        )
    assert exc.value.status_code == 503


def test_rejects_wrong_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    with pytest.raises(HTTPException) as exc:
        verify_integration_secret(
            configured_secret="expected",
            provided="wrong",
            integration_name="CRON_SECRET",
        )
    assert exc.value.status_code == 401
