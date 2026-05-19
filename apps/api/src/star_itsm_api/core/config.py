from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
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
    upload_dir: str = Field(default="/tmp/stardesk-uploads", validation_alias="UPLOAD_DIR")
    app_env: str = Field(default="development", validation_alias="APP_ENV")
    slack_client_id: str | None = Field(default=None, validation_alias="SLACK_CLIENT_ID")
    slack_client_secret: str | None = Field(default=None, validation_alias="SLACK_CLIENT_SECRET")
    slack_signing_secret: str | None = Field(default=None, validation_alias="SLACK_SIGNING_SECRET")
    slack_redirect_uri: str | None = Field(default=None, validation_alias="SLACK_REDIRECT_URI")
    slack_mock: bool = Field(default=False, validation_alias="SLACK_MOCK")

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
