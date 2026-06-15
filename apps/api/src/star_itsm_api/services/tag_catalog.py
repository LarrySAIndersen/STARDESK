"""Tag catalog — file-backed vocabulary with AI-ready suggestion interface."""

from __future__ import annotations

import re
from typing import Literal

from star_itsm_api.data.tag_catalog_data import TAG_CATALOG_ENTRIES, TagCatalogEntryData
from star_itsm_api.schemas.tag_catalog import TagCatalogEntryRead, TagSuggestionRead
from star_itsm_api.services.ticket_tags import normalize_tags

TagSuggestionSource = Literal["catalog_keyword", "catalog_rule", "llm", "manual"]

_SLUG_TO_ENTRY: dict[str, TagCatalogEntryData] = {entry.slug: entry for entry in TAG_CATALOG_ENTRIES}
_ALIAS_TO_SLUG: dict[str, str] = {}
for _entry in TAG_CATALOG_ENTRIES:
    _ALIAS_TO_SLUG[_entry.slug] = _entry.slug
    for _syn in _entry.synonyms:
        _ALIAS_TO_SLUG[_syn.lower()] = _entry.slug


def list_catalog_entries() -> list[TagCatalogEntryRead]:
    return [
        TagCatalogEntryRead(
            slug=entry.slug,
            label_da=entry.label_da,
            category=entry.category,
            keywords=list(entry.keywords),
            synonyms=list(entry.synonyms),
            auto_suggest=entry.auto_suggest,
            description_da=entry.description_da,
        )
        for entry in TAG_CATALOG_ENTRIES
    ]


def get_catalog_entry(slug: str) -> TagCatalogEntryRead | None:
    entry = _SLUG_TO_ENTRY.get(slug.strip().lower())
    if entry is None:
        return None
    return TagCatalogEntryRead(
        slug=entry.slug,
        label_da=entry.label_da,
        category=entry.category,
        keywords=list(entry.keywords),
        synonyms=list(entry.synonyms),
        auto_suggest=entry.auto_suggest,
        description_da=entry.description_da,
    )


def resolve_to_catalog_slug(raw: str) -> str | None:
    key = raw.strip().lower()
    if not key:
        return None
    return _ALIAS_TO_SLUG.get(key)


def normalize_tags_to_catalog(raw_tags: list[str] | None) -> list[str]:
    """Map freeform tags to catalog slugs where possible; keep unknown valid tags."""
    if not raw_tags:
        return []
    seen: set[str] = set()
    result: list[str] = []
    for item in raw_tags:
        canonical = resolve_to_catalog_slug(item) or item.strip().lower()
        if not canonical or canonical in seen:
            continue
        seen.add(canonical)
        result.append(canonical)
    try:
        return normalize_tags(result)
    except ValueError:
        return result[:10]


def _keyword_confidence(keyword: str, blob: str) -> float:
    if re.search(rf"\b{re.escape(keyword)}\b", blob, re.IGNORECASE):
        return 0.9
    if keyword in blob:
        return 0.75
    return 0.0


def suggest_tags_from_text(
    text: str,
    *,
    limit: int = 10,
    source: TagSuggestionSource = "catalog_keyword",
) -> list[TagSuggestionRead]:
    """
    Suggest catalog tags from free text.

    Today: keyword matching against catalog entries.
    Future: call external LLM and return source='llm' suggestions via same schema.
    """
    blob = text.strip().lower()
    if not blob:
        return []

    scored: list[tuple[float, TagCatalogEntryData, str]] = []
    for entry in TAG_CATALOG_ENTRIES:
        if not entry.auto_suggest:
            continue
        best = 0.0
        best_kw = ""
        for keyword in entry.keywords:
            conf = _keyword_confidence(keyword, blob)
            if conf > best:
                best = conf
                best_kw = keyword
        for synonym in entry.synonyms:
            conf = _keyword_confidence(synonym, blob)
            if conf > best:
                best = conf
                best_kw = synonym
        if best > 0:
            scored.append((best, entry, best_kw))

    scored.sort(key=lambda item: (-item[0], item[1].label_da))
    suggestions: list[TagSuggestionRead] = []
    seen_slugs: set[str] = set()
    for confidence, entry, keyword in scored:
        if entry.slug in seen_slugs:
            continue
        seen_slugs.add(entry.slug)
        suggestions.append(
            TagSuggestionRead(
                slug=entry.slug,
                label_da=entry.label_da,
                confidence=round(confidence, 2),
                source=source,
                reason_da=f"Matcher «{keyword}» i teksten",
            )
        )
        if len(suggestions) >= limit:
            break
    return suggestions


def slugs_from_suggestions(suggestions: list[TagSuggestionRead]) -> list[str]:
    return [item.slug for item in suggestions]


def merge_tag_suggestions(
    *groups: list[TagSuggestionRead],
    limit: int = 10,
) -> list[TagSuggestionRead]:
    """Merge suggestion lists; higher confidence wins per slug."""
    by_slug: dict[str, TagSuggestionRead] = {}
    for group in groups:
        for item in group:
            existing = by_slug.get(item.slug)
            if existing is None or item.confidence > existing.confidence:
                by_slug[item.slug] = item
    ordered = sorted(by_slug.values(), key=lambda s: (-s.confidence, s.label_da))
    return ordered[:limit]
