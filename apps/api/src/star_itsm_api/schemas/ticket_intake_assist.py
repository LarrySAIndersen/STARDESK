from typing import Literal

from pydantic import BaseModel, Field

from star_itsm_api.schemas.tag_catalog import TagSuggestionRead


class IntakeAssistMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class IntakeAssistRequest(BaseModel):
    messages: list[IntakeAssistMessage] = Field(min_length=1, max_length=50)


class IntakeAssistResponse(BaseModel):
    title: str
    description: str
    intake_answers: dict[str, str] = Field(default_factory=dict)
    suggested_priority: Literal["critical", "high", "medium", "low"]
    suggested_ticket_type: Literal["service_request", "incident", "problem"]
    tags: list[str] = Field(default_factory=list)
    tag_suggestions: list[TagSuggestionRead] = Field(
        default_factory=list,
        description="AI-ready suggestions with confidence and source",
    )
    emoji: str | None = None
