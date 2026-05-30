from pathlib import Path
from typing import Any

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parents[3]
ENV_FILES = (
    API_ROOT / ".env.vercel.production",
    API_ROOT / ".env",
    API_ROOT / ".env.local",
)
LOCAL_JWT_SECRET = "local-development-only-jwt-secret-do-not-use-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILES,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "DATABASE_URL",
            "POSTGRES_URL",
            "POSTGRES_PRISMA_URL",
        ),
    )
    frontend_url: str = Field(
        default="http://localhost:3000",
        validation_alias=AliasChoices("FRONTEND_URL", "API_CORS_ORIGINS"),
    )
    resend_api_key: str | None = Field(default=None, validation_alias="RESEND_API_KEY")
    mail_from: str | None = Field(default=None, validation_alias="MAIL_FROM")
    cron_secret: str | None = Field(default=None, validation_alias="CRON_SECRET")
    webhook_secret: str | None = Field(default=None, validation_alias="WEBHOOK_SECRET")
    jwt_secret: str | None = Field(default=None, validation_alias="JWT_SECRET")
    prototype_staff_password_hash: str | None = Field(
        default=None,
        validation_alias="PROTOTYPE_STAFF_PASSWORD_HASH",
    )
    upload_dir: str = Field(default="/tmp/stardesk-uploads", validation_alias="UPLOAD_DIR")
    blob_read_write_token: str | None = Field(
        default=None,
        validation_alias="BLOB_READ_WRITE_TOKEN",
    )
    blob_store_id: str | None = Field(
        default=None,
        validation_alias="BLOB_STORE_ID",
    )
    blob_access: str = Field(
        default="private",
        validation_alias="BLOB_ACCESS",
        description='Vercel Blob upload access: "private" or "public" (match store type).',
    )
    app_env: str = Field(default="development", validation_alias="APP_ENV")
    slack_client_id: str | None = Field(default=None, validation_alias="SLACK_CLIENT_ID")
    slack_client_secret: str | None = Field(default=None, validation_alias="SLACK_CLIENT_SECRET")
    slack_signing_secret: str | None = Field(default=None, validation_alias="SLACK_SIGNING_SECRET")
    slack_redirect_uri: str | None = Field(default=None, validation_alias="SLACK_REDIRECT_URI")
    slack_mock: bool = Field(default=False, validation_alias="SLACK_MOCK")
    google_client_id: str | None = Field(default=None, validation_alias="GOOGLE_CLIENT_ID")
    google_client_secret: str | None = Field(default=None, validation_alias="GOOGLE_CLIENT_SECRET")
    gmail_redirect_uri: str | None = Field(default=None, validation_alias="GMAIL_REDIRECT_URI")
    gmail_mock: bool = Field(default=False, validation_alias="GMAIL_MOCK")
    gmail_token_encryption_key: str | None = Field(
        default=None,
        validation_alias="GMAIL_TOKEN_ENCRYPTION_KEY",
    )
    gmail_allow_plaintext_tokens: bool = Field(
        default=False,
        validation_alias="GMAIL_ALLOW_PLAINTEXT_TOKENS",
    )
    gmail_sync_from_email: str | None = Field(
        default=None,
        validation_alias="GMAIL_SYNC_FROM_EMAIL",
    )
    gmail_default_from: str | None = Field(
        default=None,
        validation_alias="GMAIL_DEFAULT_FROM",
    )

    @field_validator(
        "database_url",
        "resend_api_key",
        "mail_from",
        "cron_secret",
        "webhook_secret",
        "jwt_secret",
        "slack_client_id",
        "slack_client_secret",
        "slack_signing_secret",
        "slack_redirect_uri",
        "google_client_id",
        "google_client_secret",
        "gmail_redirect_uri",
        "gmail_token_encryption_key",
        "gmail_sync_from_email",
        "gmail_default_from",
        "blob_read_write_token",
        "blob_store_id",
        mode="before",
    )
    @classmethod
    def _blank_optional_string_to_none(cls, value: Any) -> Any:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("frontend_url", mode="before")
    @classmethod
    def _blank_frontend_url_to_localhost(cls, value: Any) -> Any:
        if isinstance(value, str) and not value.strip():
            return "http://localhost:3000"
        return value

    @field_validator("app_env", mode="before")
    @classmethod
    def _blank_app_env_to_development(cls, value: Any) -> Any:
        if isinstance(value, str) and not value.strip():
            return "development"
        return value

    @field_validator("upload_dir", mode="before")
    @classmethod
    def _blank_upload_dir_to_tmp(cls, value: Any) -> Any:
        if isinstance(value, str) and not value.strip():
            return "/tmp/stardesk-uploads"
        return value

    @model_validator(mode="after")
    def _ensure_local_jwt_secret(self) -> "Settings":
        if not self.is_production and not self.jwt_secret:
            self.jwt_secret = LOCAL_JWT_SECRET
        return self

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() in {"production", "prod"}

    @property
    def integration_secrets_required(self) -> bool:
        """Cron/webhook endpoints must not be open when APP_ENV=production."""
        return self.is_production

    @property
    def cors_origins(self) -> list[str]:
        """Comma-separated FRONTEND_URL values (Vercel + local preview)."""
        return [origin.strip() for origin in self.frontend_url.split(",") if origin.strip()]


settings = Settings()
