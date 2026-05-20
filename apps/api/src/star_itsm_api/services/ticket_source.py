"""Ticket intake channel (`tickets.source`) — DB values and Danish UI labels."""

from __future__ import annotations

# Values persisted in `tickets.source` (DB CHECK must allow these).
TICKET_SOURCES_DB = frozenset(
    {"portal", "email", "api", "phone", "chat", "knowledge"},
)

TICKET_SOURCE_LABELS_DA: dict[str, str] = {
    "email": "E-mail",
    "phone": "Telefon",
    "chat": "Chat",
    "portal": "Selvbetjening",
    "api": "API",
    "knowledge": "Vidensartikel",
}


def ticket_source_label_da(source: str | None) -> str:
    if not source:
        return "Andet"
    return TICKET_SOURCE_LABELS_DA.get(source, "Andet")


def resolve_ticket_source_on_create(*, is_staff_user: bool, requested: str | None) -> str:
    """End users always create portal cases; staff defaults to phone if unset/invalid."""
    if not is_staff_user:
        return "portal"
    if requested in ("portal", "email", "phone", "chat"):
        return requested
    return "phone"
