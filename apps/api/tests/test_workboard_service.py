import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.models.workboard import WorkboardTask
from star_itsm_api.schemas.workboard import WorkboardTaskCreate, WorkboardTaskUpdate
from star_itsm_api.services import workboard_service


def _task(
    *,
    id: uuid.UUID | None = None,
    canvas_id: str = "t-1",
    number: int = 1,
    title: str = "Task 1",
    description: str = "",
    status: str = "Backlog",
    priority: str = "P2",
    owner: str = "",
    tags: str = "",
    source: str = "",
) -> WorkboardTask:
    return WorkboardTask(
        id=id or uuid.uuid4(),
        canvas_id=canvas_id,
        number=number,
        title=title,
        description=description,
        status=status,
        priority=priority,
        owner=owner,
        tags=tags,
        source=source,
        extra={},
        field_history={},
        activity_log=[],
    )


@pytest.mark.asyncio
async def test_next_task_number_increments_max() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one=lambda: 41))

    number = await workboard_service._next_task_number(mock_db)

    assert number == 42


@pytest.mark.asyncio
async def test_resolve_parent_id_returns_none_for_empty() -> None:
    mock_db = AsyncMock()
    parent = await workboard_service._resolve_parent_id(mock_db, None)
    assert parent is None
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_resolve_parent_id_found() -> None:
    parent_id = uuid.uuid4()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = parent_id

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    parent = await workboard_service._resolve_parent_id(mock_db, "t-12")
    assert parent == parent_id


@pytest.mark.asyncio
async def test_resolve_parent_id_not_found() -> None:
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    parent = await workboard_service._resolve_parent_id(mock_db, "t-12")
    assert parent is None


@pytest.mark.asyncio
async def test_list_tasks_all() -> None:
    task = _task(canvas_id="t-1", number=1, title="Task 1")

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [task]

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    tasks = await workboard_service.list_tasks(mock_db)
    assert len(tasks) == 1
    assert tasks[0].id == "t-1"
    assert tasks[0].title == "Task 1"


@pytest.mark.asyncio
async def test_list_tasks_by_status() -> None:
    task = _task(canvas_id="t-2", number=2, title="Task 2", status="In Progress")

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [task]

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    tasks = await workboard_service.list_tasks(mock_db, status="In Progress")
    assert len(tasks) == 1
    assert tasks[0].id == "t-2"
    assert tasks[0].status == "In Progress"


@pytest.mark.asyncio
async def test_get_task_by_canvas_id_found() -> None:
    task = _task(canvas_id="t-1", number=1, title="Task 1")

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = task

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    result = await workboard_service.get_task_by_canvas_id(mock_db, "t-1")
    assert result.id == "t-1"
    assert result.title == "Task 1"


@pytest.mark.asyncio
async def test_get_task_by_canvas_id_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=lambda: None),
    )

    with pytest.raises(LookupError, match="missing-id"):
        await workboard_service.get_task_by_canvas_id(mock_db, "missing-id")


@pytest.mark.asyncio
async def test_get_task_by_number_found() -> None:
    task = _task(canvas_id="t-1", number=1, title="Task 1")

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = task

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    result = await workboard_service.get_task_by_number(mock_db, 1)
    assert result.number == 1
    assert result.title == "Task 1"


@pytest.mark.asyncio
async def test_get_task_by_number_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=lambda: None),
    )

    with pytest.raises(LookupError, match="42"):
        await workboard_service.get_task_by_number(mock_db, 42)


@pytest.mark.asyncio
async def test_get_task_by_uuid_found() -> None:
    task_id = uuid.uuid4()
    task = _task(id=task_id, canvas_id="t-1", number=1, title="Task 1")

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = task

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    result = await workboard_service.get_task_by_uuid(mock_db, task_id)
    assert result.number == 1
    assert result.title == "Task 1"


@pytest.mark.asyncio
async def test_get_task_by_uuid_not_found() -> None:
    task_id = uuid.uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=lambda: None),
    )

    with pytest.raises(LookupError, match=str(task_id)):
        await workboard_service.get_task_by_uuid(mock_db, task_id)


@pytest.mark.asyncio
async def test_create_task_success() -> None:
    payload = WorkboardTaskCreate(
        id="t-100",
        number=100,
        title="New Task",
        description="Desc",
        status="Backlog",
        priority="P2",
        owner="Alice",
        tags="tag1",
        source="Backlog",
        parentId="t-10",
    )

    mock_db = AsyncMock()
    
    # Mock _resolve_parent_id return value
    parent_uuid = uuid.uuid4()
    mock_parent_result = MagicMock()
    mock_parent_result.scalar_one_or_none.return_value = parent_uuid
    
    # Mock existing check to return None
    mock_existing_result = MagicMock()
    mock_existing_result.scalar_one_or_none.return_value = None
    
    mock_db.execute = AsyncMock(side_effect=[mock_existing_result, mock_parent_result])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    result = await workboard_service.create_task(mock_db, payload)
    assert result.id == "t-100"
    assert result.number == 100
    assert result.title == "New Task"
    assert result.parentId == "t-10"
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited_once()
    mock_db.refresh.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_task_auto_generate_id_and_number() -> None:
    payload = WorkboardTaskCreate(
        title="Auto Task",
    )

    mock_db = AsyncMock()
    
    # Mock _next_task_number
    mock_number_result = MagicMock()
    mock_number_result.scalar_one.return_value = 4
    
    # Mock existing check
    mock_existing_result = MagicMock()
    mock_existing_result.scalar_one_or_none.return_value = None
    
    mock_db.execute = AsyncMock(side_effect=[mock_number_result, mock_existing_result])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    result = await workboard_service.create_task(mock_db, payload)
    assert result.id == "t-5"
    assert result.number == 5
    assert result.title == "Auto Task"


@pytest.mark.asyncio
async def test_create_task_duplicate_raises_value_error() -> None:
    payload = WorkboardTaskCreate(
        id="t-1",
        number=1,
        title="Duplicate",
    )

    mock_db = AsyncMock()
    
    # Mock existing check to return an existing task
    existing_task = _task(canvas_id="t-1", number=1)
    mock_existing_result = MagicMock()
    mock_existing_result.scalar_one_or_none.return_value = existing_task
    
    mock_db.execute = AsyncMock(return_value=mock_existing_result)

    with pytest.raises(ValueError, match="already exists"):
        await workboard_service.create_task(mock_db, payload)


@pytest.mark.asyncio
async def test_update_task_by_canvas_id() -> None:
    task = _task(
        canvas_id="t-1",
        number=1,
        title="Old Title",
        status="Backlog",
    )

    payload = WorkboardTaskUpdate(
        title="New Title",
        status="Refinement",  # Backlog -> Refinement is allowed (+1)
    )

    mock_db = AsyncMock()
    
    # Mock existing task query
    mock_task_result = MagicMock()
    mock_task_result.scalar_one_or_none.return_value = task
    
    # Mock parent ID resolution
    mock_parent_result = MagicMock()
    mock_parent_result.scalar_one_or_none.return_value = None
    
    mock_db.execute = AsyncMock(side_effect=[mock_task_result, mock_parent_result])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    result = await workboard_service.update_task(
        mock_db,
        canvas_id="t-1",
        payload=payload,
    )

    assert result.title == "New Title"
    assert result.status == "Refinement"
    assert task.title == "New Title"
    assert task.status == "Refinement"
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_task_by_task_id() -> None:
    task_id = uuid.uuid4()
    task = _task(
        id=task_id,
        canvas_id="t-1",
        number=1,
        title="Old Title",
        status="Backlog",
    )

    payload = WorkboardTaskUpdate(
        title="New Title",
    )

    mock_db = AsyncMock()
    mock_task_result = MagicMock()
    mock_task_result.scalar_one_or_none.return_value = task
    
    mock_db.execute = AsyncMock(return_value=mock_task_result)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    result = await workboard_service.update_task(
        mock_db,
        task_id=task_id,
        payload=payload,
    )

    assert result.title == "New Title"


@pytest.mark.asyncio
async def test_update_task_by_number() -> None:
    task = _task(
        canvas_id="t-1",
        number=1,
        title="Old Title",
        status="Backlog",
    )

    payload = WorkboardTaskUpdate(
        title="New Title",
    )

    mock_db = AsyncMock()
    mock_task_result = MagicMock()
    mock_task_result.scalar_one_or_none.return_value = task
    
    mock_db.execute = AsyncMock(return_value=mock_task_result)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    result = await workboard_service.update_task(
        mock_db,
        number=1,
        payload=payload,
    )

    assert result.title == "New Title"


@pytest.mark.asyncio
async def test_update_task_no_identifier_raises_value_error() -> None:
    mock_db = AsyncMock()
    payload = WorkboardTaskUpdate(title="New Title")

    with pytest.raises(ValueError, match="identifier required"):
        await workboard_service.update_task(mock_db, payload=payload)


@pytest.mark.asyncio
async def test_update_task_not_found_raises_lookup_error() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    payload = WorkboardTaskUpdate(title="New Title")

    with pytest.raises(LookupError, match="task"):
        await workboard_service.update_task(mock_db, canvas_id="t-1", payload=payload)


@pytest.mark.asyncio
async def test_patch_task_from_canvas_dict_create() -> None:
    raw = {
        "id": "t-100",
        "number": 100,
        "title": "Patched Task",
        "status": "Backlog",
    }

    mock_db = AsyncMock()
    
    # Mock task query -> None
    mock_task_result = MagicMock()
    mock_task_result.scalar_one_or_none.return_value = None
    
    # Mock parent ID resolution -> None
    mock_parent_result = MagicMock()
    mock_parent_result.scalar_one_or_none.return_value = None
    
    mock_db.execute = AsyncMock(side_effect=[mock_task_result, mock_parent_result])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    result = await workboard_service.patch_task_from_canvas_dict(mock_db, raw)
    assert result.id == "t-100"
    assert result.title == "Patched Task"
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_patch_task_from_canvas_dict_update() -> None:
    task = _task(
        canvas_id="t-1",
        number=1,
        title="Old Title",
        status="Backlog",
    )

    raw = {
        "id": "t-1",
        "title": "New Title",
        "status": "Refinement",  # Backlog -> Refinement is allowed
    }

    mock_db = AsyncMock()
    
    # Mock task query -> task
    mock_task_result = MagicMock()
    mock_task_result.scalar_one_or_none.return_value = task
    
    # Mock parent ID resolution -> None
    mock_parent_result = MagicMock()
    mock_parent_result.scalar_one_or_none.return_value = None
    
    mock_db.execute = AsyncMock(side_effect=[mock_task_result, mock_parent_result])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    result = await workboard_service.patch_task_from_canvas_dict(mock_db, raw)
    assert result.title == "New Title"
    assert result.status == "Refinement"
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_patch_task_from_canvas_dict_no_id_raises_value_error() -> None:
    mock_db = AsyncMock()
    with pytest.raises(ValueError, match="Canvas task id is required"):
        await workboard_service.patch_task_from_canvas_dict(mock_db, {})


@pytest.mark.asyncio
async def test_bulk_import_success() -> None:
    # 1 task to create, 1 task to update, 1 task skipped (no id)
    tasks = [
        {"id": "t-1", "number": 1, "title": "Create Me", "status": "Backlog"},
        {"id": "t-2", "number": 2, "title": "Update Me", "status": "Refinement"},  # Backlog -> Refinement is allowed
        {"number": 3, "title": "Skip Me"},
    ]

    existing_task = _task(
        canvas_id="t-2",
        number=2,
        title="Old Title",
        status="Backlog",
    )

    mock_db = AsyncMock()
    
    # First pass queries (for t-1, t-2)
    mock_result_t1 = MagicMock()
    mock_result_t1.scalar_one_or_none.return_value = None
    
    mock_result_t2 = MagicMock()
    mock_result_t2.scalar_one_or_none.return_value = existing_task
    
    # Second pass parent resolution query (for t-1, t-2)
    mock_parent_result = MagicMock()
    mock_parent_result.scalar_one_or_none.return_value = None
    
    # Soft delete query
    mock_all_rows_result = MagicMock()
    # Let's return both existing_task (seen) and stale_task (unseen)
    stale_task = _task(
        canvas_id="t-3",
        number=3,
        title="Stale",
        status="Backlog",
    )
    mock_all_rows_result.scalars.return_value.all.return_value = [existing_task, stale_task]

    mock_db.execute = AsyncMock(side_effect=[
        mock_result_t1,
        mock_result_t2,
        mock_all_rows_result,
    ])
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()

    stats = await workboard_service.bulk_import(mock_db, tasks, replace_missing=True)
    
    assert stats.created == 1
    assert stats.updated == 1
    assert stats.skipped == 1
    assert stats.soft_deleted == 1
    assert stale_task.deleted_at is not None
    mock_db.flush.assert_awaited_once()
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_export_all_tasks() -> None:
    task = _task(canvas_id="t-1", number=1, title="Task 1")

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [task]

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    exported = await workboard_service.export_all_tasks(mock_db)
    assert len(exported) == 1
    assert exported[0]["id"] == "t-1"
    assert exported[0]["title"] == "Task 1"


def test_task_query_include_deleted() -> None:
    q = workboard_service._task_query(include_deleted=True)
    # The query should not have a where clause checking deleted_at is null
    assert "IS NULL" not in str(q)


@pytest.mark.asyncio
async def test_bulk_import_status_preserved() -> None:
    tasks = [
        {"id": "t-1", "number": 1, "title": "My Task", "status": "Backlog"},  # Done -> Backlog is regression, should be blocked
    ]

    existing_task = _task(
        canvas_id="t-1",
        number=1,
        title="My Task",
        status="Done",
    )

    mock_db = AsyncMock()
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = existing_task

    mock_db.execute = AsyncMock(return_value=mock_result)
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()

    stats = await workboard_service.bulk_import(mock_db, tasks)
    
    assert stats.updated == 1
    assert stats.status_preserved == 1
    assert existing_task.status == "Done"


@pytest.mark.asyncio
async def test_bulk_import_parent_canvas_resolution() -> None:
    # t-2 has parent t-1 (which is in the import batch)
    # t-3 has parent t-99 (which is NOT in the import batch, needs DB resolution)
    tasks = [
        {"id": "t-1", "number": 1, "title": "Parent 1", "status": "Backlog"},
        {"id": "t-2", "number": 2, "title": "Child 1", "status": "Backlog", "parentId": "t-1"},
        {"id": "t-3", "number": 3, "title": "Child 2", "status": "Backlog", "parentId": "t-99"},
    ]

    mock_db = AsyncMock()
    
    # First pass queries (for t-1, t-2, t-3) -> all None (new tasks)
    mock_result_none = MagicMock()
    mock_result_none.scalar_one_or_none.return_value = None
    
    # Second pass parent resolution query for t-99
    parent_99_uuid = uuid.uuid4()
    mock_parent_99_result = MagicMock()
    mock_parent_99_result.scalar_one_or_none.return_value = parent_99_uuid

    mock_db.execute = AsyncMock(side_effect=[
        mock_result_none,
        mock_result_none,
        mock_result_none,
        mock_parent_99_result,
    ])
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()

    stats = await workboard_service.bulk_import(mock_db, tasks)
    
    assert stats.created == 3
    mock_db.flush.assert_awaited_once()
    mock_db.commit.assert_awaited_once()
