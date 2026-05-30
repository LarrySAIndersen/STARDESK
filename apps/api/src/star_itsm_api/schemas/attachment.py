from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename: str
    content_type: str
    size_bytes: int
    scan_status: str
    scan_status_label_da: str
    scanned_at: datetime | None
    created_at: datetime
    download_available: bool
    file_retrievable: bool
    file_unavailable_label_da: str | None = None
