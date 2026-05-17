from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.category import Category, Subcategory
from star_itsm_api.models.organization import Organization
from star_itsm_api.models.sub_cause import SubCause, TicketSubCause
from star_itsm_api.models.team import Team
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.schemas.ticket_intelligence import (
    TicketIntelligenceRead,
    TicketLlmContextRead,
    TicketLlmOperationalRead,
    TicketSemanticBundleRead,
)

SCORE_LABELS_DA: dict[int, str] = {
    1: "Meget lav",
    2: "Lav",
    3: "Middel",
    4: "Høj",
    5: "Meget høj",
}

EASE_LABELS_DA: dict[int, str] = {
    1: "Svær",
    2: "Besværlig",
    3: "Middel",
    4: "Let",
    5: "Meget let",
}

EVALUATION_RUBRIC_DA = (
    "Vurder sagen ud fra semantik (emne, symptomer, berørte systemer) og lethed "
    "(ease_score 1–5: høj = hurtig løsning forventes). complexity_score 1–5 angiver "
    "teknisk/domænemæssig kompleksitet uafhængigt af prioritet. Brug handling_hints "
    "som udgangspunkt; foreslå eskalering hvis is_major eller ease_score ≤ 2."
)

_DANISH_STOP = frozenset(
    {
        "og",
        "i",
        "at",
        "en",
        "et",
        "den",
        "det",
        "til",
        "er",
        "som",
        "på",
        "de",
        "med",
        "for",
        "ikke",
        "der",
        "har",
        "kan",
        "fra",
        "ved",
        "om",
        "af",
        "vi",
        "min",
        "mit",
        "denne",
        "dette",
        "bruger",
        "sag",
        "demo",
        "demosag",
    }
)

_TOPIC_KEYWORDS: tuple[tuple[str, str], ...] = (
    (r"\bvpn\b", "vpn"),
    (r"\badgang", "adgang"),
    (r"\bpassword|adgangskode|kodeord", "adgangskode"),
    (r"\bprinter|print", "printer"),
    (r"\bmail|outlook|exchange", "mail"),
    (r"\bnetwork|netværk|wifi|wi-fi", "netværk"),
    (r"\bsikkerhed|gdpr|cpr", "sikkerhed"),
    (r"\bjobflow|jobcenter", "jobflow"),
    (r"\bbi\b|business\s*intelligence|rapport", "bi"),
    (r"\beskalering|nedetid|outage", "nedetid"),
    (r"\bintegration|api\b", "integration"),
    (r"\btelefon|opkald", "telefon"),
    (r"\bsharepoint|teams|office", "microsoft365"),
)


def score_label_da(score: int | None, *, ease: bool) -> str | None:
    if score is None:
        return None
    labels = EASE_LABELS_DA if ease else SCORE_LABELS_DA
    return labels.get(score, str(score))


def extract_semantic_topics(
    *,
    title: str,
    description: str,
    tags: list[str] | None,
) -> list[str]:
    topics: list[str] = []
    seen: set[str] = set()
    for tag in tags or []:
        key = tag.strip().lower()
        if key and key not in seen:
            seen.add(key)
            topics.append(key)
    blob = f"{title} {description}".lower()
    for pattern, topic in _TOPIC_KEYWORDS:
        if re.search(pattern, blob, re.IGNORECASE) and topic not in seen:
            seen.add(topic)
            topics.append(topic)
    for word in re.findall(r"[a-zæøå]{4,}", blob):
        if word in _DANISH_STOP or word in seen:
            continue
        if len(topics) >= 12:
            break
        seen.add(word)
        topics.append(word)
    return topics[:12]


def compute_heuristic_scores(ticket: Ticket) -> tuple[int, int]:
    """Return (ease_score 1–5, complexity_score 1–5)."""
    ease = 3
    complexity = 3
    if ticket.priority in {"critical", "high"}:
        ease -= 1
        complexity += 1
    if ticket.priority == "low":
        ease += 1
        complexity -= 1
    if ticket.ticket_type == "service_request":
        ease += 1
        complexity -= 1
    elif ticket.ticket_type == "problem":
        ease -= 1
        complexity += 1
    if ticket.is_major:
        ease -= 2
        complexity += 2
    if ticket.escalation_level > 0:
        ease -= 1
        complexity += 1
    desc_len = len(ticket.description or "")
    if desc_len > 600:
        ease -= 1
        complexity += 1
    elif desc_len < 120:
        ease += 1
        complexity -= 1
    topics = extract_semantic_topics(
        title=ticket.title,
        description=ticket.description,
        tags=list(getattr(ticket, "tags", None) or []),
    )
    hard_topics = {"sikkerhed", "integration", "nedetid", "gdpr"}
    if hard_topics.intersection(topics):
        ease -= 1
        complexity += 1
    ease = max(1, min(5, ease))
    complexity = max(1, min(5, complexity))
    return ease, complexity


def build_heuristic_summary(ticket: Ticket, topics: list[str]) -> str:
    topic_part = ", ".join(topics[:5]) if topics else "generel support"
    type_da = {
        "incident": "hændelse",
        "service_request": "serviceanmodning",
        "problem": "problem",
    }.get(ticket.ticket_type, ticket.ticket_type)
    return (
        f"{type_da.capitalize()} med prioritet {ticket.priority}: {ticket.title}. "
        f"Emner: {topic_part}."
    )


def default_handling_hints(ticket: Ticket, ease: int, complexity: int) -> list[str]:
    hints: list[str] = []
    if ease >= 4:
        hints.append("Forventet hurtig afklaring — tjek kendte løsninger og FAQ først.")
    if ease <= 2:
        hints.append("Kræver erfaren agent eller koordination på tværs af grupper.")
    if complexity >= 4:
        hints.append("Dokumentér trin og afhængigheder; overvej problem-record.")
    if ticket.is_major:
        hints.append("Stor sag — følg eskaleringsprocedure og kommunikér status.")
    if ticket.fault_displayed:
        hints.append("Fejl er allerede kommunikeret til bruger — fokus på løsning.")
    if not hints:
        hints.append("Standard triage: bekræft symptomer, tildel rigtig gruppe, opdater tags.")
    return hints


def _clamp_score(value: int | None) -> int | None:
    if value is None:
        return None
    return max(1, min(5, int(value)))


def intelligence_from_ticket(ticket: Ticket) -> TicketIntelligenceRead:
    stored_ease = _clamp_score(getattr(ticket, "ease_score", None))
    stored_complexity = _clamp_score(getattr(ticket, "complexity_score", None))
    stored_topics = list(getattr(ticket, "semantic_topics", None) or [])
    stored_summary = getattr(ticket, "llm_summary", None)
    stored_hints = list(getattr(ticket, "handling_hints", None) or [])
    source = getattr(ticket, "intelligence_source", None)
    updated_at = getattr(ticket, "intelligence_updated_at", None)

    if stored_ease is not None and stored_complexity is not None:
        ease, complexity = stored_ease, stored_complexity
        topics = stored_topics or extract_semantic_topics(
            title=ticket.title,
            description=ticket.description,
            tags=list(getattr(ticket, "tags", None) or []),
        )
        summary = stored_summary or build_heuristic_summary(ticket, topics)
        hints = stored_hints or default_handling_hints(ticket, ease, complexity)
        resolved_source = source or "seed"
    else:
        ease, complexity = compute_heuristic_scores(ticket)
        topics = stored_topics or extract_semantic_topics(
            title=ticket.title,
            description=ticket.description,
            tags=list(getattr(ticket, "tags", None) or []),
        )
        summary = stored_summary or build_heuristic_summary(ticket, topics)
        hints = stored_hints or default_handling_hints(ticket, ease, complexity)
        resolved_source = source or "heuristic"

    return TicketIntelligenceRead(
        semantic_topics=topics,
        ease_score=ease,
        ease_label_da=score_label_da(ease, ease=True),
        complexity_score=complexity,
        complexity_label_da=score_label_da(complexity, ease=False),
        llm_summary=summary,
        handling_hints=hints,
        source=resolved_source,
        updated_at=updated_at,
    )


def _hours_between(start: datetime, end: datetime) -> float:
    delta = end - start
    return round(delta.total_seconds() / 3600.0, 1)


def build_semantic_bundle(
    *,
    ticket: Ticket,
    category_name: str | None,
    subcategory_name: str | None,
    sub_cause_names: list[str],
) -> TicketSemanticBundleRead:
    tags = list(getattr(ticket, "tags", None) or [])
    emoji = getattr(ticket, "emoji", None)
    parts = [
        ticket.title,
        ticket.description,
        " ".join(tags),
        emoji or "",
        category_name or "",
        subcategory_name or "",
        " ".join(sub_cause_names),
    ]
    combined = "\n".join(p.strip() for p in parts if p and p.strip())
    return TicketSemanticBundleRead(
        title=ticket.title,
        description=ticket.description,
        tags=tags,
        emoji=emoji,
        category_name_da=category_name,
        subcategory_name_da=subcategory_name,
        sub_cause_names_da=sub_cause_names,
        combined_text=combined,
    )


def build_prompt_snippet(
    ticket: Ticket,
    intelligence: TicketIntelligenceRead,
    operational: TicketLlmOperationalRead,
) -> str:
    hints = "; ".join(intelligence.handling_hints[:3])
    return (
        f"Sag {ticket.ticket_number} ({operational.ticket_type}, {operational.priority}): "
        f"{ticket.title}. Lethed {intelligence.ease_score}/5 ({intelligence.ease_label_da}), "
        f"kompleksitet {intelligence.complexity_score}/5. "
        f"Emner: {', '.join(intelligence.semantic_topics[:6]) or '—'}. "
        f"Resumé: {intelligence.llm_summary} Hints: {hints}"
    )


async def load_ticket_context_names(
    db: AsyncSession,
    ticket: Ticket,
) -> tuple[str | None, str | None, list[str], str | None, str | None, str | None]:
    category_name: str | None = None
    subcategory_name: str | None = None
    if ticket.category_id:
        cat = await db.get(Category, ticket.category_id)
        category_name = cat.name_da if cat else None
    if ticket.subcategory_id:
        sub = await db.get(Subcategory, ticket.subcategory_id)
        subcategory_name = sub.name_da if sub else None

    sc_result = await db.execute(
        select(SubCause)
        .join(TicketSubCause, TicketSubCause.sub_cause_id == SubCause.id)
        .where(TicketSubCause.ticket_id == ticket.id)
    )
    sub_cause_names = [row.name_da for row in sc_result.scalars().all()]

    team_name: str | None = None
    if ticket.assigned_team_id:
        team = await db.get(Team, ticket.assigned_team_id)
        team_name = team.name if team else None

    user_name: str | None = None
    if ticket.assigned_user_id:
        user = await db.get(User, ticket.assigned_user_id)
        user_name = user.display_name if user else None

    org_name: str | None = None
    if ticket.organization_id:
        org = await db.get(Organization, ticket.organization_id)
        org_name = org.name if org else None

    return category_name, subcategory_name, sub_cause_names, team_name, user_name, org_name


async def build_ticket_llm_context(
    db: AsyncSession,
    ticket: Ticket,
) -> TicketLlmContextRead:
    now = datetime.now(UTC)
    created = ticket.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=UTC)
    age_hours = _hours_between(created, now)

    open_hours: float | None = None
    if ticket.status not in {"closed", "cancelled", "resolved"}:
        open_hours = age_hours
    elif ticket.resolved_at:
        resolved = ticket.resolved_at
        if resolved.tzinfo is None:
            resolved = resolved.replace(tzinfo=UTC)
        open_hours = _hours_between(created, resolved)

    (
        category_name,
        subcategory_name,
        sub_cause_names,
        team_name,
        user_name,
        org_name,
    ) = await load_ticket_context_names(db, ticket)

    intelligence = intelligence_from_ticket(ticket)
    semantic_bundle = build_semantic_bundle(
        ticket=ticket,
        category_name=category_name,
        subcategory_name=subcategory_name,
        sub_cause_names=sub_cause_names,
    )
    operational = TicketLlmOperationalRead(
        status=ticket.status,
        priority=ticket.priority,
        ticket_type=ticket.ticket_type,
        is_major=ticket.is_major,
        escalation_level=ticket.escalation_level,
        fault_displayed=ticket.fault_displayed,
        assigned_team_name=team_name,
        assigned_user_name=user_name,
        organization_name=org_name,
        age_hours=age_hours,
        open_hours=open_hours,
    )
    prompt = build_prompt_snippet(ticket, intelligence, operational)
    return TicketLlmContextRead(
        ticket_id=ticket.id,
        ticket_number=ticket.ticket_number,
        intelligence=intelligence,
        semantic_bundle=semantic_bundle,
        operational=operational,
        prompt_snippet_da=prompt,
        evaluation_rubric_da=EVALUATION_RUBRIC_DA,
    )


async def build_llm_context_batch(
    db: AsyncSession,
    tickets: list[Ticket],
) -> list[TicketLlmContextRead]:
    items: list[TicketLlmContextRead] = []
    for ticket in tickets:
        items.append(await build_ticket_llm_context(db, ticket))
    return items
