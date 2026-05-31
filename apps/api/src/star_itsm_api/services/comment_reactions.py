from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.comment_reaction import CommentReaction
from star_itsm_api.schemas.comment import CommentReactionSummary, CommentRead


async def load_reaction_summaries(
    db: AsyncSession,
    comment_ids: list[uuid.UUID],
    *,
    current_user_id: uuid.UUID | None,
) -> dict[uuid.UUID, CommentReactionSummary]:
    if not comment_ids:
        return {}
    result = await db.execute(
        select(CommentReaction).where(CommentReaction.comment_id.in_(comment_ids))
    )
    positive: dict[uuid.UUID, int] = defaultdict(int)
    negative: dict[uuid.UUID, int] = defaultdict(int)
    user_sentiment: dict[uuid.UUID, str] = {}
    for row in result.scalars().all():
        if row.sentiment == "positive":
            positive[row.comment_id] += 1
        elif row.sentiment == "negative":
            negative[row.comment_id] += 1
        if current_user_id and row.user_id == current_user_id:
            user_sentiment[row.comment_id] = row.sentiment
    summaries: dict[uuid.UUID, CommentReactionSummary] = {}
    for cid in comment_ids:
        summaries[cid] = CommentReactionSummary(
            positive_count=positive.get(cid, 0),
            negative_count=negative.get(cid, 0),
            current_user_sentiment=user_sentiment.get(cid),
        )
    return summaries


def apply_reaction_summaries(
    comments: list[CommentRead],
    summaries: dict[uuid.UUID, CommentReactionSummary],
) -> list[CommentRead]:
    return [
        comment.model_copy(
            update={"reactions": summaries.get(comment.id, CommentReactionSummary())},
        )
        for comment in comments
    ]


async def set_comment_reaction(
    db: AsyncSession,
    *,
    comment_id: uuid.UUID,
    user_id: uuid.UUID,
    sentiment: str | None,
) -> CommentReactionSummary:
    existing_result = await db.execute(
        select(CommentReaction).where(
            CommentReaction.comment_id == comment_id,
            CommentReaction.user_id == user_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if sentiment is None:
        if existing is not None:
            await db.delete(existing)
    elif existing is None:
        db.add(
            CommentReaction(
                comment_id=comment_id,
                user_id=user_id,
                sentiment=sentiment,
                created_at=datetime.now(UTC),
            )
        )
    elif existing.sentiment == sentiment:
        await db.delete(existing)
    else:
        existing.sentiment = sentiment
    await db.flush()
    summaries = await load_reaction_summaries(db, [comment_id], current_user_id=user_id)
    return summaries.get(comment_id, CommentReactionSummary())
