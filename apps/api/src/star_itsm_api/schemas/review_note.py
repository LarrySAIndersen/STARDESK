from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReviewNoteCreate(BaseModel):
    page_path: str = Field(min_length=1, max_length=512)
    page_title: str = Field(default="", max_length=512)
    comment: str = Field(min_length=1, max_length=4000)
    position_x: float = Field(ge=0)
    position_y: float = Field(ge=0)
    position_selector: str | None = Field(default=None, max_length=512)


class ReviewNoteUpdate(BaseModel):
    status: str = Field(pattern=r"^(open|resolved)$")


class ReviewNoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    page_path: str
    page_title: str
    comment: str
    position_x: float
    position_y: float
    position_selector: str | None = None
    created_by_user_id: UUID
    created_by_name: str
    created_by_email: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime
