import uuid

SYSTEM_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

PRIORITY_ORDER: dict[str, int] = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}

TICKET_TYPE_PREFIX: dict[str, str] = {
    "incident": "INC",
    "service_request": "SR",
    "problem": "PRB",
    "knowledge_article": "KB",
    "idea": "IDE",
}
