"""Allowlisted ORDER BY for GET /api/v1/tickets."""

from sqlalchemy import Select, case
from sqlalchemy.sql.elements import ColumnElement

from star_itsm_api.core.constants import PRIORITY_ORDER
from star_itsm_api.models.ticket import Ticket

DEFAULT_TICKET_SORT = "created_desc"

VALID_TICKET_SORTS: frozenset[str] = frozenset(
    {
        "created_desc",
        "created_asc",
        "priority_desc",
        "sla_asc",
        "ticket_number_asc",
        "title_asc",
    }
)


def parse_ticket_sort(value: str | None) -> str:
    if value is None or value == "":
        return DEFAULT_TICKET_SORT
    if value not in VALID_TICKET_SORTS:
        raise ValueError(value)
    return value


def _priority_rank() -> ColumnElement[int]:
    return case(
        *((Ticket.priority == name, rank) for name, rank in PRIORITY_ORDER.items()),
        else_=0,
    )


def apply_ticket_sort(stmt: Select[tuple[Ticket]], sort: str) -> Select[tuple[Ticket]]:
    if sort == "created_asc":
        return stmt.order_by(Ticket.created_at.asc())
    if sort == "priority_desc":
        return stmt.order_by(_priority_rank().desc(), Ticket.created_at.desc())
    if sort == "sla_asc":
        return stmt.order_by(
            Ticket.resolution_due_at.asc().nulls_last(),
            Ticket.created_at.desc(),
        )
    if sort == "ticket_number_asc":
        return stmt.order_by(Ticket.ticket_number.asc())
    if sort == "title_asc":
        return stmt.order_by(Ticket.title.asc(), Ticket.created_at.desc())
    return stmt.order_by(Ticket.created_at.desc())
