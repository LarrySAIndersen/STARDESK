from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.schemas.ticket_routing import TicketIntakeRead, TicketRoutingRead

ROUTING_READY_THRESHOLD = 60

_PRIORITY_LABELS_DA = {
    "critical": "Kritisk",
    "high": "Høj",
    "medium": "Medium",
    "low": "Lav",
}

_PRIORITY_ORDER = {"critical": 4, "high": 3, "medium": 2, "low": 1}

_TEAM_NAME_PATTERNS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (r"\bvpn\b|netværk|network|wifi", ("SF Infrastruktur", "Infrastruktur", "Netværk")),
    (r"\badgang|password|adgangskode|kodeord|iam|rettighed", ("IAM", "Adgang", "Service Desk", "SF Service Desk")),
    (r"\bprinter|print", ("Service Desk", "SF Service Desk")),
    (r"\bmail|outlook|exchange|office|microsoft", ("Applikation", "SF Service Desk")),
    (r"\bsikkerhed|security|gdpr", ("Sikkerhed", "SF Service Desk", "Service Desk")),
)

_CATEGORY_TEAM_HINTS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("network", ("SF Infrastruktur", "Infrastruktur")),
    ("access", ("SF Service Desk", "Service Desk")),
    ("hardware", ("SF Service Desk", "Service Desk")),
    ("software", ("Applikation", "SF Service Desk")),
)


@dataclass(frozen=True)
class _TeamRef:
    id: uuid.UUID
    name: str


def _routing_metadata(ticket: Ticket) -> dict:
    raw = getattr(ticket, "routing_metadata", None)
    if isinstance(raw, dict):
        return raw
    return {}


def intake_answers_from_ticket(ticket: Ticket) -> dict[str, str]:
    intake = _routing_metadata(ticket).get("intake") or {}
    answers = intake.get("answers") if isinstance(intake, dict) else {}
    if not isinstance(answers, dict):
        return {}
    return {str(k): str(v) for k, v in answers.items() if v is not None and str(v).strip()}


def intake_metadata_from_answers(answers: dict[str, str] | None) -> dict:
    if not answers:
        return {}
    cleaned = {
        str(k): str(v).strip()
        for k, v in answers.items()
        if v is not None and str(v).strip()
    }
    if not cleaned:
        return {}
    return {"intake": {"answers": cleaned}}


def merge_intake_answers(ticket: Ticket, answers: dict[str, str] | None) -> dict:
    meta = dict(_routing_metadata(ticket))
    intake = dict(meta.get("intake") or {})
    merged = dict(intake.get("answers") or {})
    if answers:
        for key, value in answers.items():
            if value is not None and str(value).strip():
                merged[str(key)] = str(value).strip()
    intake["answers"] = merged
    meta["intake"] = intake
    return meta


def compute_completeness(
    ticket: Ticket,
    *,
    category_name_da: str | None,
    sub_causes_count: int,
) -> tuple[int, list[str]]:
    from star_itsm_api.services.ticket_intelligence import extract_semantic_topics

    score = 0
    missing: list[str] = []

    if ticket.category_id:
        score += 20
    else:
        missing.append("kategori")

    if ticket.subcategory_id:
        score += 10
    else:
        missing.append("underkategori")

    desc_len = len((ticket.description or "").strip())
    if desc_len >= 80:
        score += 20
    elif desc_len >= 40:
        score += 10
    else:
        missing.append("længere beskrivelse")

    topics = extract_semantic_topics(
        title=ticket.title,
        description=ticket.description or "",
        tags=list(getattr(ticket, "tags", None) or []),
    )
    if topics or (getattr(ticket, "tags", None) or []):
        score += 15
    else:
        missing.append("tags eller emner")

    answers = intake_answers_from_ticket(ticket)
    answered = sum(1 for v in answers.values() if v.strip())
    if answered >= 2:
        score += 30
    elif answered == 1:
        score += 15
        missing.append("flere indtags-svar")
    else:
        missing.append("indtags-svar (VPN, enhed, hastighed)")

    if sub_causes_count > 0:
        score += 5
    elif category_name_da and "adgang" not in (category_name_da or "").lower():
        missing.append("underårsag")

    return min(100, score), missing


def compute_suggested_priority(
    ticket: Ticket,
    *,
    topics: list[str],
) -> tuple[str, list[str]]:
    reasons: list[str] = []
    level = _PRIORITY_ORDER.get(ticket.priority, 2)

    if ticket.resolution_due_at and ticket.status not in {"closed", "cancelled", "resolved"}:
        from datetime import UTC, datetime

        due = ticket.resolution_due_at
        now = datetime.now(UTC)
        if due.tzinfo is None:
            due = due.replace(tzinfo=UTC)
        if now > due:
            level = max(level, _PRIORITY_ORDER["high"])
            reasons.append("SLA overskredet")

    blob = f"{ticket.title} {ticket.description}".lower()
    if re.search(r"\bkritisk|nedetid|p1\b", blob):
        level = max(level, _PRIORITY_ORDER["critical"])
        reasons.append('nøgleord "kritisk" eller nedetid')

    if ticket.is_major:
        level = max(level, _PRIORITY_ORDER["high"])
        reasons.append("stor sag")

    if ticket.ticket_type == "incident" and ticket.status == "new":
        level = max(level, _PRIORITY_ORDER["medium"])

    urgent_answer = intake_answers_from_ticket(ticket).get("urgency", "").lower()
    if any(k in urgent_answer for k in ("møde", "akut", "straks", "kritisk")):
        level = max(level, _PRIORITY_ORDER["high"])
        reasons.append("hastende indtags-svar")

    for key, value in _PRIORITY_ORDER.items():
        if value == level:
            if not reasons:
                reasons.append("standard vurdering ud fra sagstype og status")
            return key, reasons
    return "medium", reasons or ["standard vurdering"]


def _match_team_by_names(
    teams: list[_TeamRef],
    preferred_names: tuple[str, ...],
) -> _TeamRef | None:
    for hint in preferred_names:
        for team in teams:
            if team.name == hint:
                return team
        for team in teams:
            if hint.lower() in team.name.lower():
                return team
    return teams[0] if teams else None


def suggest_team(
    ticket: Ticket,
    teams: list[_TeamRef],
    *,
    category_name: str | None,
    topics: list[str],
) -> tuple[_TeamRef | None, int, str | None]:
    if not teams:
        return None, 0, None

    blob = f"{ticket.title} {ticket.description} {' '.join(topics)}".lower()
    if category_name:
        blob = f"{blob} {category_name.lower()}"

    for pattern, team_names in _TEAM_NAME_PATTERNS:
        if re.search(pattern, blob, re.IGNORECASE):
            team = _match_team_by_names(teams, team_names)
            if team:
                return team, 85, f"Regel: emne matcher {team.name}"

    if category_name:
        cat_key = (category_name or "").lower()
        for cat_hint, team_names in _CATEGORY_TEAM_HINTS:
            if cat_hint in cat_key or cat_key in cat_hint:
                team = _match_team_by_names(teams, team_names)
                if team:
                    return team, 72, f"Regel: kategori → {team.name}"

    default = _match_team_by_names(teams, ("SF Service Desk", "Service Desk"))
    if default:
        return default, 45, "Standard first-line (Service Desk)"
    return teams[0], 40, "Standard tildeling"


def build_ticket_routing(
    ticket: Ticket,
    *,
    category_name_da: str | None = None,
    sub_causes_count: int = 0,
    teams: list[_TeamRef] | None = None,
) -> TicketRoutingRead:
    from star_itsm_api.services.ticket_intelligence import extract_semantic_topics

    score, missing = compute_completeness(
        ticket,
        category_name_da=category_name_da,
        sub_causes_count=sub_causes_count,
    )
    topics = extract_semantic_topics(
        title=ticket.title,
        description=ticket.description or "",
        tags=list(getattr(ticket, "tags", None) or []),
    )
    computed, reasons = compute_suggested_priority(ticket, topics=topics)

    team_ref: _TeamRef | None = None
    confidence: int | None = None
    reason_da: str | None = None
    if teams and not ticket.assigned_team_id:
        team_ref, confidence, reason_da = suggest_team(
            ticket,
            teams,
            category_name=category_name_da,
            topics=topics,
        )

    return TicketRoutingRead(
        completeness_score=score,
        routing_ready=score >= ROUTING_READY_THRESHOLD,
        missing_fields_da=missing,
        intake=TicketIntakeRead(answers=intake_answers_from_ticket(ticket)),
        suggested_team_id=team_ref.id if team_ref else None,
        suggested_team_name=team_ref.name if team_ref else None,
        routing_confidence=confidence,
        routing_reason_da=reason_da,
        computed_priority=computed,
        computed_priority_label_da=_PRIORITY_LABELS_DA.get(computed, computed),
        computed_priority_reasons_da=reasons,
    )
