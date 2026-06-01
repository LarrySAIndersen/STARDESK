import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.schemas.comment import CommentReactionSummary, CommentRead
from star_itsm_api.services import comment_reactions


@pytest.mark.asyncio
async def test_load_reaction_summaries_empty_ids() -> None:
    mock_db = AsyncMock()
    result = await comment_reactions.load_reaction_summaries(
        mock_db,
        [],
        current_user_id=None,
    )
    assert result == {}
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_load_reaction_summaries_counts_and_user_sentiment() -> None:
    comment_id = uuid.uuid4()
    user_id = uuid.uuid4()
    other_comment = uuid.uuid4()
    positive = MagicMock(comment_id=comment_id, user_id=uuid.uuid4(), sentiment="positive")
    negative = MagicMock(comment_id=comment_id, user_id=user_id, sentiment="negative")
    other = MagicMock(comment_id=other_comment, user_id=uuid.uuid4(), sentiment="positive")

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [positive, negative, other]))
    )

    summaries = await comment_reactions.load_reaction_summaries(
        mock_db,
        [comment_id, other_comment],
        current_user_id=user_id,
    )

    assert summaries[comment_id].positive_count == 1
    assert summaries[comment_id].negative_count == 1
    assert summaries[comment_id].current_user_sentiment == "negative"
    assert summaries[other_comment].positive_count == 1
    assert summaries[other_comment].current_user_sentiment is None


def test_apply_reaction_summaries_merges() -> None:
    comment_id = uuid.uuid4()
    summary = CommentReactionSummary(positive_count=2, negative_count=1)
    comment = CommentRead(
        id=comment_id,
        body="Hej",
        is_internal=False,
        visibility="external",
        visibility_label_da="Ekstern",
        author_display_name="Anna",
        created_at=datetime.now(UTC),
    )

    updated = comment_reactions.apply_reaction_summaries([comment], {comment_id: summary})

    assert len(updated) == 1
    assert updated[0].reactions.positive_count == 2
    assert updated[0].reactions.negative_count == 1


@pytest.mark.asyncio
async def test_set_comment_reaction_removes_existing() -> None:
    comment_id = uuid.uuid4()
    user_id = uuid.uuid4()
    existing = MagicMock(sentiment="positive")

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: existing),
            MagicMock(scalars=lambda: MagicMock(all=lambda: [])),
        ]
    )
    mock_db.delete = AsyncMock()
    mock_db.flush = AsyncMock()

    summary = await comment_reactions.set_comment_reaction(
        mock_db,
        comment_id=comment_id,
        user_id=user_id,
        sentiment=None,
    )

    mock_db.delete.assert_awaited_once_with(existing)
    assert summary.positive_count == 0


@pytest.mark.asyncio
async def test_set_comment_reaction_toggles_same_sentiment() -> None:
    comment_id = uuid.uuid4()
    user_id = uuid.uuid4()
    existing = MagicMock(sentiment="positive")

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: existing),
            MagicMock(scalars=lambda: MagicMock(all=lambda: [])),
        ]
    )
    mock_db.delete = AsyncMock()
    mock_db.flush = AsyncMock()

    await comment_reactions.set_comment_reaction(
        mock_db,
        comment_id=comment_id,
        user_id=user_id,
        sentiment="positive",
    )

    mock_db.delete.assert_awaited_once_with(existing)


@pytest.mark.asyncio
async def test_set_comment_reaction_adds_new() -> None:
    comment_id = uuid.uuid4()
    user_id = uuid.uuid4()
    reaction_row = MagicMock(
        comment_id=comment_id,
        user_id=user_id,
        sentiment="negative",
    )

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: None),
            MagicMock(scalars=lambda: MagicMock(all=lambda: [reaction_row])),
        ]
    )
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()

    summary = await comment_reactions.set_comment_reaction(
        mock_db,
        comment_id=comment_id,
        user_id=user_id,
        sentiment="negative",
    )

    mock_db.add.assert_called_once()
    assert summary.negative_count == 1
