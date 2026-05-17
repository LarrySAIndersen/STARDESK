from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SubCauseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category_id: UUID | None
    name: str
    name_da: str
