from pydantic import BaseModel, Field


class TicketImportRow(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    description: str | None = None
    ticket_type: str | None = None
    priority: str | None = None
    status: str | None = None
    external_number: str | None = Field(
        default=None,
        description="TOPdesk sagsnummer eller eksternt id",
    )
    category: str | None = None
    team: str | None = None
    reporter_email: str | None = None
    is_major: str | bool | None = None
    source: str | None = None


class TicketImportRequest(BaseModel):
    rows: list[TicketImportRow] = Field(min_length=1, max_length=500)
    default_ticket_type: str = Field(default="incident")
    default_priority: str = Field(default="medium")
    on_duplicate: str = Field(default="skip", pattern="^(skip|update)$")


class TicketImportRowError(BaseModel):
    row: int
    external_number: str | None = None
    message: str


class TicketImportResult(BaseModel):
    total: int
    created: int
    updated: int
    skipped: int
    failed: int
    errors: list[TicketImportRowError] = Field(default_factory=list)
