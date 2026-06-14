"""Configurable sagstype / case-type catalog."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

IntegrationTicketPriority = Literal["critical", "high", "medium", "low"]
IntegrationTicketStatus = Literal[
    "new",
    "assigned",
    "in_progress",
    "on_hold",
    "resolved",
    "closed",
    "cancelled",
]


class CaseTypeEntry(BaseModel):
    id: str = Field(
        min_length=2,
        max_length=32,
        pattern=r"^[a-z][a-z0-9_]*$",
        description="Stable slug, e.g. incident, service_request, change.",
    )
    label_da: str = Field(min_length=2, max_length=64)
    prefix: str = Field(min_length=2, max_length=8, pattern=r"^[A-Z0-9]+$")
    description_da: str = Field(default="", max_length=500)
    enabled: bool = True
    allowed_priorities: list[IntegrationTicketPriority] = Field(min_length=1)
    allowed_statuses: list[IntegrationTicketStatus] = Field(min_length=1)

    @field_validator("prefix")
    @classmethod
    def uppercase_prefix(cls, value: str) -> str:
        return value.upper()


class CaseTypeCatalogRead(BaseModel):
    items: list[CaseTypeEntry]
    source: Literal["defaults", "platform_settings"] = "defaults"


class CaseTypeCatalogUpdate(BaseModel):
    items: list[CaseTypeEntry] = Field(min_length=1, max_length=20)
