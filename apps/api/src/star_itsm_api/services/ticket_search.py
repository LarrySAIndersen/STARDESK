from sqlalchemy import Select, func, or_

from star_itsm_api.models.ticket import Ticket


def apply_ticket_search_filter(
    stmt: Select[tuple[Ticket]],
    query: str | None,
) -> Select[tuple[Ticket]]:
    if not query or not query.strip():
        return stmt
    term = f"%{query.strip().lower()}%"
    tag_blob = func.lower(func.array_to_string(Ticket.tags, " "))
    return stmt.where(
        or_(
            func.lower(Ticket.title).like(term),
            func.lower(Ticket.description).like(term),
            func.lower(Ticket.ticket_number).like(term),
            tag_blob.like(term),
        )
    )


def apply_ticket_tags_filter(
    stmt: Select[tuple[Ticket]],
    tags: list[str] | None,
    *,
    match_all: bool = False,
) -> Select[tuple[Ticket]]:
    """Exact tag match via Postgres array operators."""
    if not tags:
        return stmt
    normalized = [t.strip().lower() for t in tags if t.strip()]
    if not normalized:
        return stmt
    if match_all:
        return stmt.where(Ticket.tags.contains(normalized))
    return stmt.where(Ticket.tags.overlap(normalized))
