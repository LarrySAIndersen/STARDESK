"""Unit tests for star_itsm_api.services.review_notes."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.schemas.review_note import ReviewNoteCreate
from star_itsm_api.services import review_notes


def _note_row(**kw: object) -> SimpleNamespace:
    now = datetime.now(UTC)
    base = {
        "id": uuid.uuid4(),
        "page_path": "/tickets",
        "page_title": "Alle sager",
        "comment": "Knappen er for lille på mobil",
        "position_x": 12.0,
        "position_y": 34.0,
        "position_selector": None,
        "screenshot_storage_key": None,
        "created_by_user_id": uuid.uuid4(),
        "status": "open",
        "created_at": now,
        "updated_at": now,
    }
    base.update(kw)
    return SimpleNamespace(**base)


def test_now_is_utc() -> None:
    assert review_notes._now().tzinfo == UTC


def test_to_read_default_email() -> None:
    row = _note_row()
    out = review_notes._to_read(row, author_name="Åse")  # type: ignore[arg-type]
    assert out.created_by_name == "Åse"
    assert out.created_by_email is None
    assert out.review_number == ""


def test_to_read_with_email() -> None:
    row = _note_row()
    out = review_notes._to_read(
        row, author_name="Bo", author_email="bo@example.dk"  # type: ignore[arg-type]
    )
    assert out.created_by_email == "bo@example.dk"


@pytest.mark.asyncio
async def test_author_profiles_empty() -> None:
    db = AsyncMock()
    out = await review_notes._author_profiles(db, set())
    assert out == {}
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_author_profiles_returns_map() -> None:
    db = AsyncMock()
    uid = uuid.uuid4()
    res = MagicMock()
    res.all.return_value = [SimpleNamespace(id=uid, display_name="Bo", email="bo@example.dk")]
    db.execute = AsyncMock(return_value=res)
    out = await review_notes._author_profiles(db, {uid})
    assert out == {uid: ("Bo", "bo@example.dk")}


@pytest.mark.asyncio
async def test_list_review_notes_no_filters() -> None:
    db = AsyncMock()
    uid = uuid.uuid4()
    row = _note_row(created_by_user_id=uid)
    rows_res = MagicMock()
    rows_res.scalars.return_value.all.return_value = [row]
    profiles_res = MagicMock()
    profiles_res.all.return_value = [
        SimpleNamespace(id=uid, display_name="Rita", email="rita@example.dk")
    ]
    numbers_res = MagicMock()
    numbers_res.scalars.return_value.all.return_value = [row.id]
    db.execute = AsyncMock(side_effect=[rows_res, profiles_res, numbers_res])
    out = await review_notes.list_review_notes(db)
    assert len(out) == 1
    assert out[0].review_number == "REV-00001"
    assert out[0].created_by_name == "Rita"
    assert out[0].created_by_email == "rita@example.dk"


@pytest.mark.asyncio
async def test_list_review_notes_with_filters_and_unknown_author() -> None:
    db = AsyncMock()
    row = _note_row()
    rows_res = MagicMock()
    rows_res.scalars.return_value.all.return_value = [row]
    profiles_res = MagicMock()
    profiles_res.all.return_value = []
    numbers_res = MagicMock()
    numbers_res.scalars.return_value.all.return_value = [row.id]
    db.execute = AsyncMock(side_effect=[rows_res, profiles_res, numbers_res])
    out = await review_notes.list_review_notes(db, page_path="/tickets", status="open")
    assert len(out) == 1
    assert out[0].review_number == "REV-00001"
    assert out[0].created_by_name == "Ukendt"
    assert out[0].created_by_email is None


@pytest.mark.asyncio
async def test_create_review_note() -> None:
    db = AsyncMock()
    db.add = MagicMock()
    author = SimpleNamespace(
        id=uuid.uuid4(), display_name="Rita Reviewer", email="rita@example.dk"
    )
    payload = ReviewNoteCreate(
        page_path="  /tickets  ",
        page_title="  Alle sager  ",
        comment="  Knappen er for lille  ",
        position_x=10,
        position_y=20,
    )
    numbers_res = MagicMock()
    numbers_res.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=numbers_res)
    out = await review_notes.create_review_note(db, payload=payload, author=author)
    assert out.page_path == "/tickets"
    assert out.page_title == "Alle sager"
    assert out.comment == "Knappen er for lille"
    assert out.status == "open"
    assert out.created_by_name == "Rita Reviewer"
    db.add.assert_called_once()
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_review_note_invalid_status() -> None:
    db = AsyncMock()
    payload = SimpleNamespace(status="bogus")
    with pytest.raises(ValueError, match="Invalid status"):
        await review_notes.update_review_note(db, note_id=uuid.uuid4(), payload=payload)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_update_review_note_not_found() -> None:
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    payload = SimpleNamespace(status="resolved")
    with pytest.raises(LookupError, match="Note not found"):
        await review_notes.update_review_note(db, note_id=uuid.uuid4(), payload=payload)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_update_review_note_success() -> None:
    db = AsyncMock()
    uid = uuid.uuid4()
    row = _note_row(created_by_user_id=uid, status="open")
    db.get = AsyncMock(return_value=row)
    profiles_res = MagicMock()
    profiles_res.all.return_value = [
        SimpleNamespace(id=uid, display_name="Bo", email="bo@example.dk")
    ]
    numbers_res = MagicMock()
    numbers_res.scalars.return_value.all.return_value = [row.id]
    db.execute = AsyncMock(side_effect=[profiles_res, numbers_res])
    payload = SimpleNamespace(status="resolved")
    out = await review_notes.update_review_note(db, note_id=row.id, payload=payload)  # type: ignore[arg-type]
    assert row.status == "resolved"
    assert out.status == "resolved"
    assert out.review_number == "REV-00001"
    assert out.created_by_name == "Bo"
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_review_note_success_unknown_author() -> None:
    db = AsyncMock()
    row = _note_row(status="open")
    db.get = AsyncMock(return_value=row)
    profiles_res = MagicMock()
    profiles_res.all.return_value = []
    numbers_res = MagicMock()
    numbers_res.scalars.return_value.all.return_value = [row.id]
    db.execute = AsyncMock(side_effect=[profiles_res, numbers_res])
    payload = SimpleNamespace(status="resolved")
    out = await review_notes.update_review_note(db, note_id=row.id, payload=payload)  # type: ignore[arg-type]
    assert out.review_number == "REV-00001"
    assert out.created_by_name == "Ukendt"
    assert out.created_by_email is None
