from uuid import UUID

from pydantic import BaseModel


class CategoryHotspot(BaseModel):
    category_id: UUID | None = None
    category_name_da: str
    avg_complexity: float | None = None
    sla_compliance_pct: float
    open_count: int
    avg_age_days: float
    risk_level: str


class IntakeHeatmapCell(BaseModel):
    day_of_week: int
    hour_of_day: int
    count: int


class RiskTicket(BaseModel):
    id: UUID
    ticket_number: str
    title: str
    priority: str
    remaining_seconds: float
    risk_score: float


class AnalyticsResponse(BaseModel):
    hotspots: list[CategoryHotspot]
    heatmap: list[IntakeHeatmapCell]
    risk_tickets: list[RiskTicket]
