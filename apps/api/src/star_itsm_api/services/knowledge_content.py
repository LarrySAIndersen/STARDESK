"""Structured vidensartikel-indhold i tickets.routing_metadata.knowledge."""

from __future__ import annotations

from star_itsm_api.models.ticket import Ticket

KNOWLEDGE_META_KEY = "knowledge"

SECTION_SUMMARY = "summary"
SECTION_SYMPTOMS = "symptoms"
SECTION_SOLUTION = "solution"
SECTION_RELATED = "related_topics"

SECTION_HEADINGS_DA = {
    SECTION_SUMMARY: "Resumé",
    SECTION_SYMPTOMS: "Symptomer",
    SECTION_SOLUTION: "Løsning",
    SECTION_RELATED: "Relaterede emner",
}

EMPTY_SECTIONS: dict[str, str] = {
    SECTION_SUMMARY: "",
    SECTION_SYMPTOMS: "",
    SECTION_SOLUTION: "",
    SECTION_RELATED: "",
}


def _routing_metadata(ticket: Ticket) -> dict:
    raw = getattr(ticket, "routing_metadata", None)
    return dict(raw) if isinstance(raw, dict) else {}


def get_knowledge_sections(ticket: Ticket) -> dict[str, str]:
    meta = _routing_metadata(ticket)
    stored = meta.get(KNOWLEDGE_META_KEY)
    if isinstance(stored, dict):
        return {
            SECTION_SUMMARY: str(stored.get(SECTION_SUMMARY) or ""),
            SECTION_SYMPTOMS: str(stored.get(SECTION_SYMPTOMS) or ""),
            SECTION_SOLUTION: str(stored.get(SECTION_SOLUTION) or ""),
            SECTION_RELATED: str(stored.get(SECTION_RELATED) or ""),
        }
    return dict(EMPTY_SECTIONS)


def build_knowledge_description(sections: dict[str, str]) -> str:
    parts: list[str] = []
    for key in (SECTION_SUMMARY, SECTION_SYMPTOMS, SECTION_SOLUTION, SECTION_RELATED):
        body = (sections.get(key) or "").strip()
        if body:
            parts.append(f"## {SECTION_HEADINGS_DA[key]}\n{body}")
    return "\n\n".join(parts)


def sections_have_min_content(sections: dict[str, str], *, min_chars: int = 10) -> bool:
    combined = " ".join((sections.get(key) or "").strip() for key in EMPTY_SECTIONS)
    return len(combined) >= min_chars


def set_knowledge_sections(ticket: Ticket, sections: dict[str, str]) -> None:
    normalized = {
        SECTION_SUMMARY: (sections.get(SECTION_SUMMARY) or "").strip(),
        SECTION_SYMPTOMS: (sections.get(SECTION_SYMPTOMS) or "").strip(),
        SECTION_SOLUTION: (sections.get(SECTION_SOLUTION) or "").strip(),
        SECTION_RELATED: (sections.get(SECTION_RELATED) or "").strip(),
    }
    meta = _routing_metadata(ticket)
    meta[KNOWLEDGE_META_KEY] = normalized
    ticket.routing_metadata = meta
    ticket.description = build_knowledge_description(normalized)
