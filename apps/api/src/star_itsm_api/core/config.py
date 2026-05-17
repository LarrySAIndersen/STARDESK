from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str | None = Field(default=None, validation_alias="DATABASE_URL")
    frontend_url: str = Field(
        default="http://localhost:3000",
        validation_alias="FRONTEND_URL",
    )
    resend_api_key: str | None = Field(default=None, validation_alias="RESEND_API_KEY")
    mail_from: str | None = Field(default=None, validation_alias="MAIL_FROM")
    cron_secret: str | None = Field(default=None, validation_alias="CRON_SECRET")
    webhook_secret: str | None = Field(default=None, validation_alias="WEBHOOK_SECRET")
    jwt_secret: str | None = Field(default=None, validation_alias="JWT_SECRET")

    @property
    def cors_origins(self) -> list[str]:
        """Comma-separated FRONTEND_URL values (Vercel + local preview)."""
        return [origin.strip() for origin in self.frontend_url.split(",") if origin.strip()]


settings = Settings()
