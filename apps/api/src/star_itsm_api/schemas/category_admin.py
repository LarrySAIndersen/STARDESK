from uuid import UUID

from pydantic import BaseModel, Field


class SubcategoryAdminRead(BaseModel):
    id: UUID
    category_id: UUID
    name: str
    name_da: str
    sort_order: int
    is_active: bool


class CategoryAdminRead(BaseModel):
    id: UUID
    name: str
    name_da: str
    sort_order: int
    is_active: bool
    subcategories: list[SubcategoryAdminRead] = []


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128, pattern=r"^[a-z][a-z0-9_]*$")
    name_da: str = Field(min_length=1, max_length=128)
    sort_order: int = 0
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128, pattern=r"^[a-z][a-z0-9_]*$")
    name_da: str | None = Field(default=None, min_length=1, max_length=128)
    sort_order: int | None = None
    is_active: bool | None = None


class SubcategoryCreate(BaseModel):
    category_id: UUID
    name: str = Field(min_length=1, max_length=128, pattern=r"^[a-z][a-z0-9_]*$")
    name_da: str = Field(min_length=1, max_length=128)
    sort_order: int = 0
    is_active: bool = True


class SubcategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128, pattern=r"^[a-z][a-z0-9_]*$")
    name_da: str | None = Field(default=None, min_length=1, max_length=128)
    sort_order: int | None = None
    is_active: bool | None = None


class CategorySyncResult(BaseModel):
    categories_created: int
    subcategories_created: int
    categories_total: int


class CategoryFillTicketsResult(BaseModel):
    ticket_count: int
    updated_count: int
    dry_run: bool
    category_name: str
    subcategory_name: str
