from pydantic import BaseModel, Field


class TagCatalogEntryRead(BaseModel):
    slug: str
    label_da: str
    category: str
    keywords: list[str] = Field(default_factory=list)
    synonyms: list[str] = Field(default_factory=list)
    auto_suggest: bool = True
    description_da: str | None = None
    usage_count: int | None = None


class TagSuggestionRead(BaseModel):
    """AI-ready tag suggestion — source distinguishes rule vs future LLM."""

    slug: str
    label_da: str
    confidence: float = Field(ge=0.0, le=1.0)
    source: str = Field(
        description="catalog_keyword | catalog_rule | llm | manual",
    )
    reason_da: str | None = None


class TagSuggestResponse(BaseModel):
    suggestions: list[TagSuggestionRead] = Field(default_factory=list)
    suggested_slugs: list[str] = Field(default_factory=list)


class SimilarTicketRead(BaseModel):
    id: str
    ticket_number: str
    title: str
    status: str
    score: float = Field(ge=0.0, le=1.0)
    match_reasons: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
