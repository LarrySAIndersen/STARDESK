"""Unit tests for star_itsm_api.services.ticket_stakeholders internals."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.models.entity_relationship import EntityRelationship
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_stakeholder import TicketStakeholder
from star_itsm_api.models.user import User
from star_itsm_api.schemas.stakeholder import TicketStakeholdersGroupedRead
from star_itsm_api.services import ticket_stakeholders as svc


def _user(
    *,
    user_id: uuid.UUID | None = None,
    email: str = "anna@example.dk",
    display_name: str = "Anna Agent",
) -> User:
    return User(
        id=user_id or uuid.uuid4(),
        email=email,
        display_name=display_name,
        role="agent",
        is_active=True,
        password_hash=None,
        deleted_at=None,
    )


def _stakeholder(
    *,
    ticket_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    role: str = "affected",
) -> TicketStakeholder:
    now = datetime.now(UTC)
    return TicketStakeholder(
        id=uuid.uuid4(),
        ticket_id=ticket_id or uuid.uuid4(),
        user_id=user_id,
        role=role,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )


def _execute_result(*, scalars_all=None, scalar_one_or_none=None):
    result = MagicMock()
    if scalars_all is not None:
        result.scalars.return_value.all.return_value = scalars_all
    if scalar_one_or_none is not None or scalars_all is None:
        result.scalar_one_or_none.return_value = scalar_one_or_none
    return result


def test_empty_stakeholders_grouped() -> None:
    grouped = svc.empty_stakeholders_grouped()
    assert grouped.affected == []
    assert grouped.interested == []
    assert grouped.mentioned == []


def test_now_returns_aware_datetime() -> None:
    now = svc._now()
    assert now.tzinfo is not None


@pytest.mark.asyncio
async def test_load_users_map_empty_returns_empty() -> None:
    mock_db = AsyncMock()
    result = await svc._load_users_map(mock_db, set())
    assert result == {}
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_load_users_map_returns_mapping() -> None:
    user = _user()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_execute_result(scalars_all=[user]))

    result = await svc._load_users_map(mock_db, {user.id})
    assert result == {user.id: user}


@pytest.mark.asyncio
async def test_validate_stakeholder_user_ids_empty() -> None:
    mock_db = AsyncMock()
    await svc.validate_stakeholder_user_ids(mock_db, [])
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_validate_stakeholder_user_ids_all_found() -> None:
    user = _user()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_execute_result(scalars_all=[user]))

    await svc.validate_stakeholder_user_ids(mock_db, [user.id])


@pytest.mark.asyncio
async def test_validate_stakeholder_user_ids_missing_raises() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_execute_result(scalars_all=[]))

    with pytest.raises(ValueError, match="Invalid user id"):
        await svc.validate_stakeholder_user_ids(mock_db, [uuid.uuid4()])


def test_record_entity_relationship_adds_row() -> None:
    mock_db = MagicMock()
    source_id = uuid.uuid4()
    target_id = uuid.uuid4()
    now = datetime.now(UTC)

    row = svc.record_entity_relationship(
        mock_db,
        source_type="user",
        source_id=source_id,
        target_type="ticket",
        target_id=target_id,
        relationship_type="affected",
        metadata={"k": "v"},
        now=now,
    )

    assert isinstance(row, EntityRelationship)
    assert row.source_id == source_id
    assert row.target_id == target_id
    assert row.metadata_ == {"k": "v"}
    assert row.created_at == now
    mock_db.add.assert_called_once_with(row)


def test_record_entity_relationship_defaults() -> None:
    mock_db = MagicMock()
    row = svc.record_entity_relationship(
        mock_db,
        source_type="user",
        source_id=uuid.uuid4(),
        target_type="ticket",
        target_id=uuid.uuid4(),
        relationship_type="affected",
    )
    assert row.metadata_ == {}
    assert row.created_at is not None


def test_record_ticket_user_relationship_known_role() -> None:
    mock_db = MagicMock()
    with patch.object(svc, "record_entity_relationship") as mock_rec:
        svc.record_ticket_user_relationship(
            mock_db,
            ticket_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            role="mentioned",
        )
    assert mock_rec.call_args.kwargs["relationship_type"] == "mentioned_in_comment"


def test_record_ticket_user_relationship_unknown_role_passthrough() -> None:
    mock_db = MagicMock()
    with patch.object(svc, "record_entity_relationship") as mock_rec:
        svc.record_ticket_user_relationship(
            mock_db,
            ticket_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            role="custom_role",
        )
    assert mock_rec.call_args.kwargs["relationship_type"] == "custom_role"


@pytest.mark.asyncio
async def test_get_active_stakeholder_returns_row() -> None:
    existing = _stakeholder()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_execute_result(scalar_one_or_none=existing))

    result = await svc._get_active_stakeholder(
        mock_db, ticket_id=existing.ticket_id, user_id=uuid.uuid4(), role="affected"
    )
    assert result is existing


@pytest.mark.asyncio
async def test_upsert_stakeholder_invalid_role_raises() -> None:
    mock_db = AsyncMock()
    with pytest.raises(ValueError, match="Invalid stakeholder role"):
        await svc.upsert_stakeholder(
            mock_db, ticket_id=uuid.uuid4(), user_id=uuid.uuid4(), role="bogus"
        )


@pytest.mark.asyncio
async def test_upsert_stakeholder_existing_updates_timestamp() -> None:
    existing = _stakeholder()
    now = datetime.now(UTC)
    mock_db = AsyncMock()
    with patch.object(svc, "_get_active_stakeholder", new=AsyncMock(return_value=existing)):
        result = await svc.upsert_stakeholder(
            mock_db,
            ticket_id=existing.ticket_id,
            user_id=existing.user_id,
            role="affected",
            now=now,
        )
    assert result is existing
    assert existing.updated_at == now
    mock_db.add.assert_not_called()


@pytest.mark.asyncio
async def test_upsert_stakeholder_creates_new() -> None:
    ticket_id = uuid.uuid4()
    user_id = uuid.uuid4()
    now = datetime.now(UTC)
    mock_db = MagicMock()
    with (
        patch.object(svc, "_get_active_stakeholder", new=AsyncMock(return_value=None)),
        patch.object(svc, "record_ticket_user_relationship", new=AsyncMock()) as mock_rel,
    ):
        row = await svc.upsert_stakeholder(
            mock_db,
            ticket_id=ticket_id,
            user_id=user_id,
            role="affected",
            now=now,
            metadata={"x": 1},
        )
    assert isinstance(row, TicketStakeholder)
    assert row.ticket_id == ticket_id
    assert row.user_id == user_id
    assert row.role == "affected"
    mock_db.add.assert_called_once_with(row)
    mock_rel.assert_awaited_once()


@pytest.mark.asyncio
async def test_sync_role_stakeholders_invalid_role_raises() -> None:
    mock_db = AsyncMock()
    with pytest.raises(ValueError, match="cannot be synced"):
        await svc.sync_role_stakeholders(
            mock_db, ticket_id=uuid.uuid4(), role="requester", user_ids=[]
        )


@pytest.mark.asyncio
async def test_sync_role_stakeholders_soft_deletes_and_upserts() -> None:
    ticket_id = uuid.uuid4()
    keep_id = uuid.uuid4()
    drop_id = uuid.uuid4()
    now = datetime.now(UTC)

    row_keep = _stakeholder(ticket_id=ticket_id, user_id=keep_id, role="affected")
    row_drop = _stakeholder(ticket_id=ticket_id, user_id=drop_id, role="affected")
    row_none = _stakeholder(ticket_id=ticket_id, user_id=None, role="affected")

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=_execute_result(scalars_all=[row_keep, row_drop, row_none])
    )

    with patch.object(svc, "upsert_stakeholder", new=AsyncMock()) as mock_upsert:
        await svc.sync_role_stakeholders(
            mock_db, ticket_id=ticket_id, role="affected", user_ids=[keep_id], now=now
        )

    assert row_drop.deleted_at == now
    assert row_none.deleted_at == now
    assert row_keep.deleted_at is None
    mock_upsert.assert_awaited_once()


@pytest.mark.asyncio
async def test_sync_ticket_stakeholders_on_create_with_lists() -> None:
    ticket_id = uuid.uuid4()
    reporter_id = uuid.uuid4()
    affected = [uuid.uuid4()]
    interested = [uuid.uuid4()]

    mock_db = AsyncMock()
    with (
        patch.object(svc, "record_ticket_user_relationship", new=AsyncMock()) as mock_rel,
        patch.object(svc, "upsert_stakeholder", new=AsyncMock()) as mock_upsert,
        patch.object(svc, "validate_stakeholder_user_ids", new=AsyncMock()) as mock_val,
        patch.object(svc, "sync_role_stakeholders", new=AsyncMock()) as mock_sync,
    ):
        await svc.sync_ticket_stakeholders_on_create(
            mock_db,
            ticket_id=ticket_id,
            reporter_user_id=reporter_id,
            affected_user_ids=affected,
            interested_user_ids=interested,
        )

    mock_rel.assert_awaited_once()
    mock_upsert.assert_awaited_once()
    assert mock_val.await_count == 2
    assert mock_sync.await_count == 2


@pytest.mark.asyncio
async def test_sync_ticket_stakeholders_on_create_no_lists() -> None:
    mock_db = AsyncMock()
    with (
        patch.object(svc, "record_ticket_user_relationship", new=AsyncMock()),
        patch.object(svc, "upsert_stakeholder", new=AsyncMock()),
        patch.object(svc, "validate_stakeholder_user_ids", new=AsyncMock()) as mock_val,
        patch.object(svc, "sync_role_stakeholders", new=AsyncMock()) as mock_sync,
    ):
        await svc.sync_ticket_stakeholders_on_create(
            mock_db,
            ticket_id=uuid.uuid4(),
            reporter_user_id=uuid.uuid4(),
            affected_user_ids=[],
            interested_user_ids=[],
        )

    mock_val.assert_not_awaited()
    mock_sync.assert_not_awaited()


@pytest.mark.asyncio
async def test_list_stakeholders_for_ticket() -> None:
    row = _stakeholder()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_execute_result(scalars_all=[row]))

    rows = await svc.list_stakeholders_for_ticket(mock_db, row.ticket_id)
    assert rows == [row]


@pytest.mark.asyncio
async def test_stakeholders_to_grouped_read_groups_and_skips() -> None:
    ticket_id = uuid.uuid4()
    user = _user()

    valid_row = _stakeholder(ticket_id=ticket_id, user_id=user.id, role="affected")
    none_user_row = _stakeholder(ticket_id=ticket_id, user_id=None, role="interested")
    bad_role_row = _stakeholder(ticket_id=ticket_id, user_id=user.id, role="requester")
    missing_user_row = _stakeholder(ticket_id=ticket_id, user_id=uuid.uuid4(), role="mentioned")

    mock_db = AsyncMock()
    with patch.object(svc, "_load_users_map", new=AsyncMock(return_value={user.id: user})):
        grouped = await svc.stakeholders_to_grouped_read(
            mock_db, [valid_row, none_user_row, bad_role_row, missing_user_row]
        )

    assert len(grouped.affected) == 1
    assert grouped.affected[0].user_id == user.id
    assert grouped.interested == []
    assert grouped.mentioned == []


@pytest.mark.asyncio
async def test_get_ticket_stakeholders_grouped_success() -> None:
    ticket_id = uuid.uuid4()
    expected = TicketStakeholdersGroupedRead()

    mock_db = AsyncMock()
    nested = AsyncMock()
    nested.__aenter__ = AsyncMock(return_value=nested)
    nested.__aexit__ = AsyncMock(return_value=False)
    mock_db.begin_nested = MagicMock(return_value=nested)

    with (
        patch.object(svc, "list_stakeholders_for_ticket", new=AsyncMock(return_value=[])),
        patch.object(svc, "stakeholders_to_grouped_read", new=AsyncMock(return_value=expected)),
    ):
        grouped = await svc.get_ticket_stakeholders_grouped(mock_db, ticket_id)

    assert grouped is expected


@pytest.mark.asyncio
async def test_stakeholder_to_read_with_user() -> None:
    user = _user()
    row = _stakeholder(user_id=user.id, role="affected")
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=user)

    read = await svc.stakeholder_to_read(mock_db, row)
    assert read.display_name == user.display_name
    assert read.email == user.email
    assert read.user_id == user.id


@pytest.mark.asyncio
async def test_stakeholder_to_read_user_not_found() -> None:
    row = _stakeholder(user_id=uuid.uuid4(), role="affected")
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)

    read = await svc.stakeholder_to_read(mock_db, row)
    assert read.display_name is None
    assert read.email is None


@pytest.mark.asyncio
async def test_stakeholder_to_read_without_user_id() -> None:
    row = _stakeholder(user_id=None, role="affected")
    mock_db = AsyncMock()

    read = await svc.stakeholder_to_read(mock_db, row)
    assert read.display_name is None
    assert read.email is None
    mock_db.get.assert_not_awaited()


def test_soft_delete_stakeholder() -> None:
    row = _stakeholder()
    now = datetime.now(UTC)
    svc.soft_delete_stakeholder(MagicMock(), row, now=now)
    assert row.deleted_at == now
    assert row.updated_at == now


def test_soft_delete_stakeholder_default_now() -> None:
    row = _stakeholder()
    svc.soft_delete_stakeholder(MagicMock(), row)
    assert row.deleted_at is not None


def test_apply_stakeholder_ticket_filter() -> None:
    from sqlalchemy import select

    stmt = select(Ticket)
    result = svc.apply_stakeholder_ticket_filter(stmt, user_id=uuid.uuid4())
    assert result is not None
    assert str(result) != str(stmt)


def test_extract_mention_tokens_dedup_name() -> None:
    # Punctuation stops the name match, yielding two identical "Anna" tokens;
    # the second is dropped by the dedup guard.
    tokens = svc._extract_mention_tokens("@Anna! @Anna!")
    assert tokens.count("Anna") == 1


def test_extract_mention_tokens_email_then_name() -> None:
    tokens = svc._extract_mention_tokens("@bob@example.dk hi @Charlie Brown")
    assert "bob@example.dk" in tokens
    assert any("Charlie" in t for t in tokens)


@pytest.mark.asyncio
async def test_resolve_mentioned_user_ids_no_tokens() -> None:
    mock_db = AsyncMock()
    result = await svc.resolve_mentioned_user_ids(mock_db, "no mentions here")
    assert result == []
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_resolve_mentioned_user_ids_by_name_and_exclude() -> None:
    target = _user(email="charlie@example.dk", display_name="Charlie")
    excluded = _user(email="self@example.dk", display_name="Self")

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=_execute_result(scalars_all=[excluded, target])
    )

    ids = await svc.resolve_mentioned_user_ids(
        mock_db, "@Charlie @Self", exclude_user_id=excluded.id
    )
    assert ids == [target.id]


@pytest.mark.asyncio
async def test_resolve_mentioned_user_ids_dedup_same_email() -> None:
    # Two identical email tokens: second hits the "already seen" guard on the
    # email branch and breaks without re-appending.
    user = _user(email="dana@example.dk", display_name="Dana")

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_execute_result(scalars_all=[user]))

    ids = await svc.resolve_mentioned_user_ids(
        mock_db, "@dana@example.dk and @dana@example.dk"
    )
    assert ids == [user.id]


@pytest.mark.asyncio
async def test_resolve_mentioned_user_ids_dedup_name_already_seen() -> None:
    # Email token resolves first; a later matching name token for the same user
    # hits the "already seen" guard on the display-name branch.
    user = _user(email="dana@example.dk", display_name="Dana")

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_execute_result(scalars_all=[user]))

    ids = await svc.resolve_mentioned_user_ids(mock_db, "@dana@example.dk and @Dana")
    assert ids == [user.id]


@pytest.mark.asyncio
async def test_process_comment_mentions_upserts_each() -> None:
    ticket_id = uuid.uuid4()
    comment_id = uuid.uuid4()
    author_id = uuid.uuid4()
    mentioned = [uuid.uuid4(), uuid.uuid4()]

    mock_db = AsyncMock()
    with (
        patch.object(
            svc, "resolve_mentioned_user_ids", new=AsyncMock(return_value=mentioned)
        ) as mock_resolve,
        patch.object(svc, "upsert_stakeholder", new=AsyncMock()) as mock_upsert,
    ):
        result = await svc.process_comment_mentions(
            mock_db,
            ticket_id=ticket_id,
            comment_id=comment_id,
            body="@a @b",
            author_user_id=author_id,
        )

    assert result == mentioned
    mock_resolve.assert_awaited_once()
    assert mock_upsert.await_count == 2
