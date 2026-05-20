from datetime import UTC, datetime

from star_itsm_api.services.gmail import (
    GmailApiError,
    InboundEmailMessage,
    assert_connected_mailbox_allowed,
    build_outbound_from_address,
    build_reply_subject,
    build_ticket_description_from_email,
    normalize_ticket_title_from_subject,
    parse_gmail_message,
)


def _b64(value: str) -> str:
    import base64

    return base64.urlsafe_b64encode(value.encode("utf-8")).decode("utf-8")


def test_thread_message_parsing_extracts_ids_and_body() -> None:
    payload = {
        "id": "gmail-123",
        "threadId": "thread-999",
        "internalDate": "1710000000000",
        "payload": {
            "mimeType": "multipart/alternative",
            "headers": [
                {"name": "From", "value": "Kunde <kunde@example.com>"},
                {"name": "To", "value": "support@example.dk"},
                {"name": "Subject", "value": "Re: Netværk nede"},
                {"name": "Message-Id", "value": "<abc@example.com>"},
                {"name": "In-Reply-To", "value": "<prior@example.com>"},
            ],
            "parts": [
                {"mimeType": "text/plain", "body": {"data": _b64("Hej\nDet virker ikke endnu")}},
            ],
        },
    }

    parsed = parse_gmail_message(payload)

    assert parsed is not None
    assert parsed.gmail_message_id == "gmail-123"
    assert parsed.gmail_thread_id == "thread-999"
    assert parsed.from_email == "kunde@example.com"
    assert "virker ikke" in parsed.body_text


def test_ticket_creation_payload_uses_email_content() -> None:
    message = InboundEmailMessage(
        gmail_message_id="m1",
        gmail_thread_id="t1",
        internet_message_id="<m1@example.com>",
        subject="Re: [INC-2026-00001] Printer virker ikke",
        from_email="kunde@example.com",
        to_email="support@example.dk",
        body_text="Printeren står stadig fast i fejltilstand.",
        received_at=datetime.now(UTC),
        in_reply_to=None,
        references=None,
    )

    title = normalize_ticket_title_from_subject(message.subject)
    description = build_ticket_description_from_email(message)

    assert title == "[INC-2026-00001] Printer virker ikke"
    assert "E-mail modtaget fra kunde@example.com" in description
    assert "Printeren står stadig fast" in description


def test_reply_subject_includes_ticket_number() -> None:
    subject = build_reply_subject("INC-2026-00042", "Driftforstyrrelse i kasse 3")
    assert subject.startswith("Re: [INC-2026-00042]")


def test_outbound_from_uses_display_name_and_connected_email() -> None:
    header = build_outbound_from_address(connected_email="proto.star.itsm@gmail.com")
    assert "STAR Service Desk" in header
    assert "proto.star.itsm@gmail.com" in header


def test_connected_mailbox_validation(monkeypatch) -> None:
    from star_itsm_api.core import config

    monkeypatch.setattr(config.settings, "gmail_sync_from_email", "proto.star.itsm@gmail.com")
    assert_connected_mailbox_allowed("proto.star.itsm@gmail.com")
    try:
        assert_connected_mailbox_allowed("other@gmail.com")
    except GmailApiError:
        pass
    else:
        raise AssertionError("expected GmailApiError for wrong mailbox")
