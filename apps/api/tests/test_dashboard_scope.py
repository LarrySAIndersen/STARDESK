import uuid

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services.dashboard_scope import (
    DashboardScope,
    filter_tickets_by_scope,
    ticket_in_scope,
)


def _ticket(
    *,
    assigned_user_id: uuid.UUID | None = None,
    assigned_team_id: uuid.UUID | None = None,
    reporter_user_id: uuid.UUID | None = None,
) -> Ticket:
    ticket = Ticket()
    ticket.assigned_user_id = assigned_user_id
    ticket.assigned_team_id = assigned_team_id
    ticket.reporter_user_id = reporter_user_id or uuid.uuid4()
    return ticket


def test_personal_scope_union() -> None:
    user_id = uuid.uuid4()
    team_id = uuid.uuid4()
    other_team = uuid.uuid4()

    mine = _ticket(assigned_user_id=user_id)
    group = _ticket(assigned_team_id=team_id)
    created = _ticket(reporter_user_id=user_id)
    other = _ticket(assigned_team_id=other_team)

    filtered = filter_tickets_by_scope(
        [mine, group, created, other],
        user=type("U", (), {"id": user_id})(),
        team_ids=[team_id],
        scope=DashboardScope.personal,
    )
    assert set(filtered) == {mine, group, created}


def test_ticket_in_scope_mine_only() -> None:
    user_id = uuid.uuid4()
    ticket = _ticket(assigned_user_id=user_id)
    assert ticket_in_scope(
        ticket,
        user_id=user_id,
        team_ids=[],
        scope=DashboardScope.mine,
    )
