from pydantic import BaseModel, Field


class SlaResetResponse(BaseModel):
    ticket_count: int = Field(description="Antal ikke-slettede sager der berøres")
    updated_count: int = Field(description="Antal sager opdateret (0 ved dry_run)")
    dry_run: bool
    anchor: str = Field(description="created_at eller now")
