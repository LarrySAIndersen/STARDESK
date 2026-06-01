import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

from star_itsm_api.services.ticket_privacy import ticket_sensitive_fields


def _ticket(**kwargs) -> SimpleNamespace:
    defaults = {
        "reporter_user_id": uuid.uuid4(),
        "subject_cpr": "0101901234",
        "gdpr_consent": True,
        "gdpr_consent_at": datetime(2026, 1, 1, tzinfo=UTC),
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_staff_sees_full_cpr_and_consent() -> None:
    ticket = _ticket()
    staff = SimpleNamespace(id=uuid.uuid4(), role="admin")
    fields = ticket_sensitive_fields(ticket, staff)
    assert fields["subject_cpr"] == "0101901234"
    assert fields["gdpr_consent_at"] is not None


def test_reporter_sees_masked_cpr() -> None:
    reporter_id = uuid.uuid4()
    ticket = _ticket(reporter_user_id=reporter_id)
    reporter = SimpleNamespace(id=reporter_id, role="end_user")
    fields = ticket_sensitive_fields(ticket, reporter)
    assert fields["subject_cpr"] == "010190-****"
    assert fields["gdpr_consent_at"] is not None


def test_other_user_sees_no_sensitive_fields() -> None:
    ticket = _ticket()
    stranger = SimpleNamespace(id=uuid.uuid4(), role="end_user")
    fields = ticket_sensitive_fields(ticket, stranger)
    assert fields["subject_cpr"] is None
    assert fields["gdpr_consent_at"] is None
    assert fields["gdpr_consent"] is True
