from pydantic import BaseModel, Field


class SidebarNavVisibilityRead(BaseModel):
    hidden_nav_ids: list[str] = Field(default_factory=list)


class SidebarNavVisibilityUpdate(BaseModel):
    hidden_nav_ids: list[str] = Field(default_factory=list, max_length=32)
