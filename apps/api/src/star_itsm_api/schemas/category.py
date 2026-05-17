from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SubcategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    name_da: str


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    name_da: str
    subcategories: list[SubcategoryRead] = []
