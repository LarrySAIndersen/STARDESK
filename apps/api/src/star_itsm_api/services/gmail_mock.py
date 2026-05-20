from datetime import UTC, datetime

MOCK_GMAIL_EMAIL = "support@example.dk"


def mock_messages() -> list[dict]:
    now = datetime.now(UTC)
    return [
        {
            "gmail_message_id": "mock-msg-001",
            "gmail_thread_id": "mock-thread-001",
            "internet_message_id": "<mock-msg-001@example.dk>",
            "subject": "Internet nede i butik Aarhus",
            "from_email": "kunde@example.com",
            "to_email": MOCK_GMAIL_EMAIL,
            "body_text": (
                "Hej support,\n\n"
                "Vi har ikke internet siden kl. 07:30 i butikken.\n"
                "Kan I kigge på det?\n\nMvh Kunde"
            ),
            "received_at": now,
        },
        {
            "gmail_message_id": "mock-msg-002",
            "gmail_thread_id": "mock-thread-001",
            "internet_message_id": "<mock-msg-002@example.dk>",
            "subject": "Re: Internet nede i butik Aarhus",
            "from_email": "kunde@example.com",
            "to_email": MOCK_GMAIL_EMAIL,
            "body_text": "Update: Vi kan stadig ikke komme på nettet.",
            "received_at": now,
        },
    ]
