"""Test ticket fixtures (typed Ticket instances for Sonar S5655)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from star_itsm_api.models.ticket import Ticket


def make_test_ticket(**overrides: Any) -> Ticket:
    ticket = Ticket()
    ticket.id = overrides.pop("id", uuid.uuid4())
    ticket.ticket_number = overrides.pop("ticket_number", "INC-2026-00001")
    ticket.ticket_type = overrides.pop("ticket_type", "incident")
    ticket.title = overrides.pop("title", "Test ticket")
    ticket.description = overrides.pop("description", "")
    ticket.status = overrides.pop("status", "new")
    ticket.priority = overrides.pop("priority", "medium")
    ticket.reporter_user_id = overrides.pop("reporter_user_id", uuid.uuid4())
    ticket.source = overrides.pop("source", "portal")
    ticket.sla_pause_total_seconds = overrides.pop("sla_pause_total_seconds", 0)
    ticket.is_major = overrides.pop("is_major", False)
    ticket.is_security_ticket = overrides.pop("is_security_ticket", False)
    ticket.subject_cpr = overrides.pop("subject_cpr", None)
    ticket.gdpr_consent = overrides.pop("gdpr_consent", False)
    ticket.gdpr_consent_at = overrides.pop("gdpr_consent_at", None)
    ticket.assigned_team_id = overrides.pop("assigned_team_id", None)
    ticket.response_due_at = overrides.pop("response_due_at", None)
    ticket.resolution_due_at = overrides.pop("resolution_due_at", None)
    ticket.sla_paused_at = overrides.pop("sla_paused_at", None)
    ticket.created_at = overrides.pop("created_at", datetime.now(UTC))
    for key, value in overrides.items():
        setattr(ticket, key, value)
    return ticket
