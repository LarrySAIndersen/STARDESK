"""Tests for review note screenshot encoding."""

import base64

import pytest
from pydantic import ValidationError

from star_itsm_api.schemas.review_note import ReviewNoteCreate, decode_review_note_screenshot

_PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def test_decode_review_note_screenshot_none() -> None:
    assert decode_review_note_screenshot(None) is None
    assert decode_review_note_screenshot("") is None
    assert decode_review_note_screenshot("   ") is None


def test_decode_review_note_screenshot_accepts_png() -> None:
    encoded = base64.b64encode(_PNG_BYTES).decode("ascii")
    assert decode_review_note_screenshot(encoded) == _PNG_BYTES


def test_decode_review_note_screenshot_accepts_data_url() -> None:
    encoded = base64.b64encode(_PNG_BYTES).decode("ascii")
    data_url = f"data:image/png;base64,{encoded}"
    assert decode_review_note_screenshot(data_url) == _PNG_BYTES


def test_decode_review_note_screenshot_rejects_non_png() -> None:
    encoded = base64.b64encode(b"not-a-png").decode("ascii")
    with pytest.raises(ValueError, match="PNG"):
        decode_review_note_screenshot(encoded)


def test_review_note_create_validates_screenshot_base64() -> None:
    encoded = base64.b64encode(_PNG_BYTES).decode("ascii")
    payload = ReviewNoteCreate(
        page_path="/tickets",
        comment="Test",
        position_x=1,
        position_y=2,
        screenshot_base64=encoded,
    )
    assert payload.screenshot_base64 == encoded


def test_review_note_create_rejects_invalid_screenshot_base64() -> None:
    with pytest.raises(ValidationError):
        ReviewNoteCreate(
            page_path="/tickets",
            comment="Test",
            position_x=1,
            position_y=2,
            screenshot_base64="%%%",
        )
