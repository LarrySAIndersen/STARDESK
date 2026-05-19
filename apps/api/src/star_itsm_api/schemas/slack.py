from pydantic import BaseModel, ConfigDict, Field


class SlackChannelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    channel_id: str
    name: str
    display_name_da: str
    is_private: bool


class SlackPushRequest(BaseModel):
    channel_id: str = Field(min_length=1, max_length=64)


class SlackPushResponse(BaseModel):
    channel_id: str
    channel_name: str
    mock: bool = False
    message_ts: str | None = None


class SlackStatusRead(BaseModel):
    connected: bool
    enabled: bool
    team_id: str | None = None
    team_name: str | None = None
    default_channel_id: str | None = None
    webhook_url: str | None = None
    mode: str = "real"


class SlackOAuthStartResponse(BaseModel):
    authorize_url: str


class SlackOAuthCallbackResponse(BaseModel):
    connected: bool
    team_id: str
    team_name: str


class SlackSettingsUpdate(BaseModel):
    enabled: bool | None = None
    default_channel_id: str | None = Field(default=None, max_length=64)
    webhook_url: str | None = Field(default=None, max_length=1000)
