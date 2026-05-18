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
    mock: bool = True
