"""Find similar tickets using tags, semantic topics, and text overlap."""

from __future__ import annotations

import re

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.schemas.tag_catalog import SimilarTicketRead
from star_itsm_api.services.knowledge_articles import exclude_knowledge_articles
from star_itsm_api.services.org_access import apply_ticket_list_filter

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
    }
)

_WEIGHT_TAGS = 0.4
_WEIGHT_TOPICS = 0.2
_WEIGHT_TEXT = 0.3
_WEIGHT_SUMMARY = 0.1


def _tokenize(text: str) -> set[str]:
    words = re.findall(r"[a-zæøå0-9]{4,}", text.lower())
    return {w for w in words if w not in _DANISH_STOP}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    intersection = len(a & b)
    union = len(a | b)
    return intersection / union if union else 0.0


def _overlap_labels(shared: set[str], *, prefix_da: str) -> str | None:
    if not shared:
        return None
    sample = ", ".join(sorted(shared)[:4])
    extra = len(shared) - 4
    if extra > 0:
        sample = f"{sample} +{extra}"
    return f"{prefix_da}: {sample}"


def score_ticket_similarity(source: Ticket, candidate: Ticket) -> tuple[float, list[str]]:
    reasons: list[str] = []

    source_tags = set(getattr(source, "tags", None) or [])
    candidate_tags = set(getattr(candidate, "tags", None) or [])
    tag_score = _jaccard(source_tags, candidate_tags)
    tag_reason = _overlap_labels(source_tags & candidate_tags, prefix_da="Fælles tags")
    if tag_reason:
        reasons.append(tag_reason)

    source_topics = set(getattr(source, "semantic_topics", None) or [])
    candidate_topics = set(getattr(candidate, "semantic_topics", None) or [])
    topic_score = _jaccard(source_topics, candidate_topics)
    topic_reason = _overlap_labels(source_topics & candidate_topics, prefix_da="Fælles emner")
    if topic_reason:
        reasons.append(topic_reason)

    source_tokens = _tokenize(f"{source.title} {source.description}")
    candidate_tokens = _tokenize(f"{candidate.title} {candidate.description}")
    text_score = _jaccard(source_tokens, candidate_tokens)
    if text_score >= 0.15:
        reasons.append("Lignende titel/beskrivelse")

    summary_score = 0.0
    source_summary = (getattr(source, "llm_summary", None) or "").strip()
    candidate_summary = (getattr(candidate, "llm_summary", None) or "").strip()
    if source_summary and candidate_summary:
        summary_score = _jaccard(_tokenize(source_summary), _tokenize(candidate_summary))
        if summary_score >= 0.1:
            reasons.append("Lignende opsummering")

    total = (
        _WEIGHT_TAGS * tag_score
        + _WEIGHT_TOPICS * topic_score
        + _WEIGHT_TEXT * text_score
        + _WEIGHT_SUMMARY * summary_score
    )
    return round(min(total, 1.0), 3), reasons


def _candidate_search_terms(source: Ticket) -> list[str]:
    terms: list[str] = []
    for tag in getattr(source, "tags", None) or []:
        if tag.strip():
            terms.append(tag.strip().lower())
    for topic in getattr(source, "semantic_topics", None) or []:
        if topic.strip() and topic not in terms:
            terms.append(topic.strip().lower())
    for word in _tokenize(source.title):
        if len(terms) < 8:
            terms.append(word)
    return terms[:8]


async def find_similar_tickets(
    db: AsyncSession,
    source: Ticket,
    current_user,
    *,
    limit: int = 5,
    closed_only: bool = False,
    candidate_pool: int = 120,
) -> list[SimilarTicketRead]:
    stmt: Select[tuple[Ticket]] = select(Ticket).where(
        Ticket.deleted_at.is_(None),
        Ticket.id != source.id,
        Ticket.is_knowledge_article.is_(False),
    )
    stmt = exclude_knowledge_articles(stmt)
    stmt = apply_ticket_list_filter(stmt, current_user, store_sager=False)

    if closed_only:
        stmt = stmt.where(Ticket.status.in_(("resolved", "closed")))

    search_terms = _candidate_search_terms(source)
    if search_terms:
        tag_blob = func.lower(func.array_to_string(Ticket.tags, " "))
        topic_blob = func.lower(func.array_to_string(Ticket.semantic_topics, " "))
        title_desc = func.lower(func.concat(Ticket.title, " ", Ticket.description))
        predicates = []
        for term in search_terms:
            like = f"%{term}%"
            predicates.append(tag_blob.like(like))
            predicates.append(topic_blob.like(like))
            predicates.append(title_desc.like(like))
        stmt = stmt.where(or_(*predicates))

    stmt = stmt.order_by(Ticket.updated_at.desc()).limit(candidate_pool)
    result = await db.execute(stmt)
    candidates = list(result.scalars().all())

    scored: list[tuple[float, Ticket, list[str]]] = []
    for candidate in candidates:
        score, reasons = score_ticket_similarity(source, candidate)
        if score > 0.05:
            scored.append((score, candidate, reasons))

    scored.sort(key=lambda item: (-item[0], item[1].updated_at or item[1].created_at))

    output: list[SimilarTicketRead] = []
    for score, candidate, reasons in scored[:limit]:
        output.append(
            SimilarTicketRead(
                id=str(candidate.id),
                ticket_number=candidate.ticket_number,
                title=candidate.title,
                status=candidate.status,
                score=score,
                match_reasons=reasons or ["Svag tekstlig lighed"],
                tags=list(getattr(candidate, "tags", None) or []),
            )
        )
    return output
