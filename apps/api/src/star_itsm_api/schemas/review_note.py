import base64
import binascii
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

_SCREENSHOT_B64_MAX_LEN = 2_800_000
_SCREENSHOT_BYTES_MAX = 2_000_000
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def decode_review_note_screenshot(data: str | None) -> bytes | None:
    if data is None:
        return None
    raw = data.strip()
    if not raw:
        return None
    if raw.startswith("data:"):
        _, _, raw = raw.partition(",")
    try:
        decoded = base64.b64decode(raw, validate=True)
    except binascii.Error as exc:
        msg = "Invalid screenshot encoding"
        raise ValueError(msg) from exc
    if len(decoded) > _SCREENSHOT_BYTES_MAX:
        msg = "Screenshot too large"
        raise ValueError(msg)
    if not decoded.startswith(_PNG_MAGIC):
        msg = "Screenshot must be PNG"
        raise ValueError(msg)
    return decoded


class ReviewNoteCreate(BaseModel):
    page_path: str = Field(min_length=1, max_length=512)
    page_title: str = Field(default="", max_length=512)
    comment: str = Field(min_length=1, max_length=4000)
    position_x: float = Field(ge=0)
    position_y: float = Field(ge=0)
    position_selector: str | None = Field(default=None, max_length=512)
    screenshot_base64: str | None = Field(default=None, max_length=_SCREENSHOT_B64_MAX_LEN)

    @field_validator("screenshot_base64")
    @classmethod
    def validate_screenshot_base64(cls, value: str | None) -> str | None:
        if value is None:
            return None
        decode_review_note_screenshot(value)
        return value


class ReviewNoteUpdate(BaseModel):
    status: str = Field(pattern=r"^(open|resolved|deleted)$")


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
    has_screenshot: bool = False
    created_at: datetime
    updated_at: datetime
