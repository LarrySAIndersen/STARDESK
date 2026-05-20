"""Unit tests for SF chat service helpers (no database)."""

from star_itsm_api.services.sf_chat import MSG_CHAT_CLOSED, MSG_QUEUE_REJECTED


def test_chat_closed_message_danish() -> None:
    assert "ikke åben" in MSG_CHAT_CLOSED.lower() or "åben" in MSG_CHAT_CLOSED


def test_queue_rejected_message_danish() -> None:
    assert "kø" in MSG_QUEUE_REJECTED.lower()
    assert "utilgængelig" in MSG_QUEUE_REJECTED.lower()
