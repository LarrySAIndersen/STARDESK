from datetime import datetime

from pydantic import BaseModel, Field


class GmailOAuthStartResponse(BaseModel):
    authorize_url: str


class GmailOAuthCallbackResponse(BaseModel):
    connected: bool
    connected_email: str


class GmailStatusRead(BaseModel):
    connected: bool
    enabled: bool
    connected_email: str | None = None
    last_history_id: str | None = None
    last_sync_at: datetime | None = None
    mode: str = "real"


class GmailSettingsUpdate(BaseModel):
    enabled: bool | None = None


class GmailSyncResponse(BaseModel):
    processed: int
    created_tickets: int
    appended_to_threads: int
    skipped_duplicates: int
    mode: str = "real"


class GmailTestResponse(BaseModel):
    ok: bool
    connected_email: str | None = None
    detail: str = Field(default="OK")
