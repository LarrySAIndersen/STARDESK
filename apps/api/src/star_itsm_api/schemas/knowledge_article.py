from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from star_itsm_api.services.knowledge_articles import (
    KNOWLEDGE_STATUS_DRAFT,
    KNOWLEDGE_STATUS_LABELS_DA,
    KNOWLEDGE_VISIBILITY_EXTERNAL,
    KNOWLEDGE_VISIBILITY_INTERNAL,
    KNOWLEDGE_VISIBILITY_LABELS_DA,
)
from star_itsm_api.services.knowledge_content import (
    EMPTY_SECTIONS,
    get_knowledge_sections,
    sections_have_min_content,
    set_knowledge_sections,
)
from star_itsm_api.services.ticket_tags import normalize_tags


class KnowledgeArticleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_number: str
    title: str
    description: str
    summary: str = ""
    symptoms: str = ""
    solution: str = ""
    related_topics: str = ""
    knowledge_status: str
    knowledge_status_label_da: str
    knowledge_visibility: str
    knowledge_visibility_label_da: str
    tags: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime | None = None


class KnowledgeArticleCreate(BaseModel):
    title: str = Field(min_length=3, max_length=256)
    description: str | None = Field(default=None, min_length=10)
    summary: str = ""
    symptoms: str = ""
    solution: str = ""
    related_topics: str = ""
    knowledge_status: Literal["draft", "published"] = KNOWLEDGE_STATUS_DRAFT
    knowledge_visibility: Literal["internal", "external"] = KNOWLEDGE_VISIBILITY_EXTERNAL
    tags: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("tags")
    @classmethod
    def normalize_tags_field(cls, value: list[str]) -> list[str]:
        return normalize_tags(value)

    @model_validator(mode="after")
    def validate_body(self) -> "KnowledgeArticleCreate":
        sections = {
            "summary": self.summary,
            "symptoms": self.symptoms,
            "solution": self.solution,
            "related_topics": self.related_topics,
        }
        has_description = self.description is not None and len(self.description.strip()) >= 10
        if not has_description and not sections_have_min_content(sections):
            raise ValueError(
                "Angiv mindst 10 tegn i indholdet "
                "(resumé, symptomer, løsning eller relaterede emner)."
            )
        return self


class KnowledgeArticleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=256)
    description: str | None = Field(default=None, min_length=10)
    summary: str | None = None
    symptoms: str | None = None
    solution: str | None = None
    related_topics: str | None = None
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


def _sections_payload_from_create(payload: KnowledgeArticleCreate) -> dict[str, str]:
    return {
        "summary": payload.summary,
        "symptoms": payload.symptoms,
        "solution": payload.solution,
        "related_topics": payload.related_topics,
    }


def apply_create_sections(ticket, payload: KnowledgeArticleCreate) -> None:  # noqa: ANN001
    sections = _sections_payload_from_create(payload)
    if any(v.strip() for v in sections.values()):
        set_knowledge_sections(ticket, sections)
    elif payload.description:
        ticket.description = payload.description.strip()


def apply_update_sections(ticket, payload: KnowledgeArticleUpdate) -> None:  # noqa: ANN001
    data = payload.model_dump(exclude_unset=True)
    section_keys = {"summary", "symptoms", "solution", "related_topics"}
    if not section_keys.intersection(data):
        if "description" in data and data["description"] is not None:
            ticket.description = data["description"]
        return
    current = get_knowledge_sections(ticket)
    merged = dict(current)
    for key in EMPTY_SECTIONS:
        if key in data and data[key] is not None:
            merged[key] = data[key]
    set_knowledge_sections(ticket, merged)


def knowledge_article_to_read(ticket) -> KnowledgeArticleRead:  # noqa: ANN001
    status = ticket.knowledge_status or KNOWLEDGE_STATUS_DRAFT
    visibility = ticket.knowledge_visibility or KNOWLEDGE_VISIBILITY_INTERNAL
    sections = get_knowledge_sections(ticket)
    return KnowledgeArticleRead(
        id=ticket.id,
        ticket_number=ticket.ticket_number,
        title=ticket.title,
        description=ticket.description,
        summary=sections["summary"],
        symptoms=sections["symptoms"],
        solution=sections["solution"],
        related_topics=sections["related_topics"],
        knowledge_status=status,
        knowledge_status_label_da=KNOWLEDGE_STATUS_LABELS_DA.get(status, status),
        knowledge_visibility=visibility,
        knowledge_visibility_label_da=KNOWLEDGE_VISIBILITY_LABELS_DA.get(visibility, visibility),
        tags=list(ticket.tags or []),
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )
