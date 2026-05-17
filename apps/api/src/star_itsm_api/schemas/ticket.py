from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_number: str
    title: str
    status: str
    priority: str
    created_at: datetime
