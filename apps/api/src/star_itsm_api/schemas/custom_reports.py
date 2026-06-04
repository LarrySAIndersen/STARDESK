from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field
from star_itsm_api.schemas.report import ReportTicketRow


class CustomReportGroupRow(BaseModel):
    group_key: str
    group_label_da: str
    count: int
    percentage: float
    avg_resolution_time_hours: float | None = None
    sla_compliance_pct: float | None = None
    tickets: list[ReportTicketRow] = Field(default_factory=list)


class CustomReportResponse(BaseModel):
    generated_at: datetime
    group_by: str
    total_tickets: int
    groups: list[CustomReportGroupRow]


class PredefinedReportItem(BaseModel):
    label_da: str
    count: int
    metric_value: float  # compliance pct, hours, or fcr pct
    metric_label_da: str  # e.g., "94.5% overholdt", "3.2 timer (MTTR)", etc.
    percentage: float | None = None


class PredefinedReportSection(BaseModel):
    title_da: str
    description_da: str
    metric_name_da: str  # e.g., "SLA Overholdelsesgrad", "MTTR (Løsningstid)", "FCR Grad"
    items: list[PredefinedReportItem]


class PredefinedReportsResponse(BaseModel):
    generated_at: datetime
    sections: list[PredefinedReportSection]
