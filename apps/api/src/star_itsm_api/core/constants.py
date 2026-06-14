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
    "wreck_ind": "WRI",
    "knowledge_article": "KB",
    "idea": "IDE",
}

WRECK_IND_TICKET_TYPE = "wreck_ind"

ITSM_TICKET_TYPES: tuple[str, ...] = (
    "incident",
    "service_request",
    "problem",
    WRECK_IND_TICKET_TYPE,
)
