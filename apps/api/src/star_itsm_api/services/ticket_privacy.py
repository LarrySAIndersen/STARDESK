from datetime import datetime

from star_itsm_api.core.security import is_staff
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.services.cpr import mask_cpr


def ticket_sensitive_fields(ticket: Ticket, user: User) -> dict[str, bool | datetime | str | None]:
    staff = is_staff(user)
    is_reporter = user.id == ticket.reporter_user_id

    subject_cpr: str | None = None
    if staff and ticket.subject_cpr:
        subject_cpr = ticket.subject_cpr
    elif is_reporter and ticket.subject_cpr:
        subject_cpr = mask_cpr(ticket.subject_cpr)

    gdpr_consent_at: datetime | None = None
    if staff or is_reporter:
        gdpr_consent_at = ticket.gdpr_consent_at

    return {
        "gdpr_consent": ticket.gdpr_consent,
        "gdpr_consent_at": gdpr_consent_at,
        "subject_cpr": subject_cpr,
    }
