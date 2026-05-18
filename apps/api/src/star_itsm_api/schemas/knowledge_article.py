from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from star_itsm_api.services.knowledge_articles import (
    KNOWLEDGE_STATUS_DRAFT,
    KNOWLEDGE_STATUS_PUBLISHED,
    KNOWLEDGE_VISIBILITY_EXTERNAL,
    KNOWLEDGE_VISIBILITY_INTERNAL,
    KNOWLEDGE_STATUS_LABELS_DA,
    KNOWLEDGE_VISIBILITY_LABELS_DA,
)
from star_itsm_api.services.ticket_tags import normalize_tags


class KnowledgeArticleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_number: str
    title: str
    description: str
    knowledge_status: str
    knowledge_status_label_da: str
    knowledge_visibility: str
    knowledge_visibility_label_da: str
    tags: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime | None = None


class KnowledgeArticleCreate(BaseModel):
    title: str = Field(min_length=3, max_length=256)
    description: str = Field(min_length=10)
    knowledge_status: Literal["draft", "published"] = KNOWLEDGE_STATUS_DRAFT
    knowledge_visibility: Literal["internal", "external"] = KNOWLEDGE_VISIBILITY_EXTERNAL
    tags: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("tags")
    @classmethod
    def normalize_tags_field(cls, value: list[str]) -> list[str]:
        return normalize_tags(value)


class KnowledgeArticleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=256)
    description: str | None = Field(default=None, min_length=10)
    knowledge_status: Literal["draft", "published"] | None = None
    knowledge_visibility: Literal["internal", "external"] | None = None
    tags: list[str] | None = Field(default=None, max_length=10)

    @field_validator("tags")
    @classmethod
    def normalize_tags_field(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return normalize_tags(value)


class KnowledgeArticlePromote(BaseModel):
    knowledge_status: Literal["draft", "published"] = KNOWLEDGE_STATUS_DRAFT
    knowledge_visibility: Literal["internal", "external"] = KNOWLEDGE_VISIBILITY_EXTERNAL


def knowledge_article_to_read(ticket) -> KnowledgeArticleRead:  # noqa: ANN001
    status = ticket.knowledge_status or KNOWLEDGE_STATUS_DRAFT
    visibility = ticket.knowledge_visibility or KNOWLEDGE_VISIBILITY_INTERNAL
    return KnowledgeArticleRead(
        id=ticket.id,
        ticket_number=ticket.ticket_number,
        title=ticket.title,
        description=ticket.description,
        knowledge_status=status,
        knowledge_status_label_da=KNOWLEDGE_STATUS_LABELS_DA.get(status, status),
        knowledge_visibility=visibility,
        knowledge_visibility_label_da=KNOWLEDGE_VISIBILITY_LABELS_DA.get(visibility, visibility),
        tags=list(ticket.tags or []),
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )
