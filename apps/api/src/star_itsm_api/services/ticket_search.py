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
