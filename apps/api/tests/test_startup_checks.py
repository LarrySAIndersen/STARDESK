import pytest

from star_itsm_api.core.config import settings
from star_itsm_api.core.startup_checks import validate_production_settings


def test_production_rejects_weak_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "jwt_secret", "change-me-in-production-use-a-long-random-string")
    monkeypatch.setattr(settings, "cron_secret", "cron-ok-secret-value-here-12345")
    monkeypatch.setattr(settings, "webhook_secret", "webhook-ok-secret-value-here-12345")
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        validate_production_settings()


def test_production_accepts_strong_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "jwt_secret", "x" * 32)
    monkeypatch.setattr(settings, "cron_secret", "cron-secret")
    monkeypatch.setattr(settings, "webhook_secret", "webhook-secret")
    validate_production_settings()


def test_production_rejects_missing_cron_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "jwt_secret", "x" * 32)
    monkeypatch.setattr(settings, "cron_secret", None)
    monkeypatch.setattr(settings, "webhook_secret", "webhook-secret")
    with pytest.raises(RuntimeError, match="CRON_SECRET"):
        validate_production_settings()


def test_production_rejects_missing_webhook_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "jwt_secret", "x" * 32)
    monkeypatch.setattr(settings, "cron_secret", "cron-secret")
    monkeypatch.setattr(settings, "webhook_secret", None)
    with pytest.raises(RuntimeError, match="WEBHOOK_SECRET"):
        validate_production_settings()


def test_non_production_skips_validation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "jwt_secret", "change-me")
    validate_production_settings()
