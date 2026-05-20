"""Unit tests for SF chat service helpers (no database)."""

import uuid
from datetime import UTC, datetime

from star_itsm_api.schemas.sf_chat import SfChatMessageRead
from star_itsm_api.services.sf_chat import (
    MSG_CHAT_CLOSED,
    MSG_QUEUE_REJECTED,
    _estimated_wait_minutes,
    format_sf_chat_transcript_da,
)
from star_itsm_api.services.sf_chat_bot import mock_bot_reply


def test_chat_closed_message_danish() -> None:
    assert "ikke åben" in MSG_CHAT_CLOSED.lower() or "åben" in MSG_CHAT_CLOSED


def test_queue_rejected_message_danish() -> None:
    assert "kø" in MSG_QUEUE_REJECTED.lower()
    assert "utilgængelig" in MSG_QUEUE_REJECTED.lower()


def test_format_sf_chat_transcript_da() -> None:
    sid = uuid.uuid4()
    mid = uuid.uuid4()
    dt = datetime(2026, 1, 2, 15, 30, tzinfo=UTC)
    msgs = [
        SfChatMessageRead(
            id=mid,
            session_id=sid,
            sender_user_id=None,
            sender_display_name="System",
            body="Kunden har forladt chatten.",
            created_at=dt,
            is_own=False,
            is_system=True,
        ),
    ]
    text = format_sf_chat_transcript_da(msgs)
    assert "System" in text
    assert "Kunden har forladt chatten." in text
    assert "2026-01-02" in text


def test_estimated_wait_minutes() -> None:
    assert _estimated_wait_minutes(0, 2) is None
    assert _estimated_wait_minutes(3, 0) == 12
    assert _estimated_wait_minutes(2, 2) == 3


def test_mock_bot_reply_mine_sager_da() -> None:
    reply = mock_bot_reply("vis mine sager", [], display_name="Anna")
    assert "ingen egne sager" in reply.lower() or "sag" in reply.lower()
