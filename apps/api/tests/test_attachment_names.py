from datetime import UTC, datetime

from star_itsm_api.services.attachment_names import build_attachment_filename


def test_build_attachment_filename_incident_and_timestamp() -> None:
    created = datetime(2026, 5, 30, 22, 3, 1, tzinfo=UTC)
    name = build_attachment_filename(
        ticket_number="INC-42",
        created_at=created,
        original_filename="image.png",
    )
    assert name == "INC-42-20260530-220301.png"


def test_build_attachment_filename_sanitizes_ticket_number() -> None:
    created = datetime(2026, 1, 2, 8, 9, 10, tzinfo=UTC)
    name = build_attachment_filename(
        ticket_number=" INC/99 ",
        created_at=created,
        original_filename="photo.JPG",
    )
    assert name == "INC-99-20260102-080910.jpg"


def test_build_attachment_filename_default_ext_without_suffix() -> None:
    created = datetime(2026, 1, 2, 8, 9, 10, tzinfo=UTC)
    name = build_attachment_filename(
        ticket_number="INC-1",
        created_at=created,
        original_filename="noext",
    )
    assert name == "INC-1-20260102-080910.bin"
