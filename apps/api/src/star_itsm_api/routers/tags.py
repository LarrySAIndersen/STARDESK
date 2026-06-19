"""Tag catalog API — vocabulary list and text-based suggestions (AI-ready)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import get_current_user
from star_itsm_api.deps import require_db
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.schemas.tag_catalog import TagCatalogEntryRead, TagSuggestResponse
from star_itsm_api.services.knowledge_articles import exclude_knowledge_articles
from star_itsm_api.services.tag_catalog import (
    list_catalog_entries,
    slugs_from_suggestions,
    suggest_tags_from_text,
)
from star_itsm_api.services.ticket_tags import normalize_tags

router = APIRouter(prefix="/tags", tags=["tags"])


async def _attach_usage_counts(
    db: AsyncSession,
    entries: list[TagCatalogEntryRead],
) -> list[TagCatalogEntryRead]:
    stmt = select(Ticket.tags).where(Ticket.deleted_at.is_(None))
    stmt = exclude_knowledge_articles(stmt)
    try:
        rows = (await db.execute(stmt)).all()
    except Exception:
        return entries
    counts: dict[str, int] = {}
    for (tags,) in rows:
        for tag in tags or []:
            key = str(tag).lower()
            counts[key] = counts.get(key, 0) + 1
    return [
        entry.model_copy(update={"usage_count": counts.get(entry.slug, 0)}) for entry in entries
    ]


@router.get("")
async def list_tags(
    include_usage: bool = Query(
        default=True,
        description="Include ticket usage count per catalog slug",
    ),
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(get_current_user),
) -> list[TagCatalogEntryRead]:
    entries = list_catalog_entries()
    if not include_usage:
        return entries
    return await _attach_usage_counts(db, entries)


@router.get("/suggest")
async def suggest_tags(
    text: str = Query(min_length=1, max_length=8000, description="Title + description to analyze"),
    limit: int = Query(default=10, ge=1, le=10),
    _current_user: User = Depends(get_current_user),
) -> TagSuggestResponse:
    suggestions = suggest_tags_from_text(text, limit=limit)
    return TagSuggestResponse(
        suggestions=suggestions,
        suggested_slugs=slugs_from_suggestions(suggestions),
    )


@router.get("/validate")
async def validate_tag_slugs(
    tags: str = Query(description="Comma-separated tag slugs to validate against catalog"),
    _current_user: User = Depends(get_current_user),
) -> dict[str, list[str]]:
    try:
        parsed = normalize_tags([part.strip() for part in tags.split(",") if part.strip()])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    catalog_slugs = {entry.slug for entry in list_catalog_entries()}
    known = [tag for tag in parsed if tag in catalog_slugs]
    unknown = [tag for tag in parsed if tag not in catalog_slugs]
    return {"known": known, "unknown": unknown}
