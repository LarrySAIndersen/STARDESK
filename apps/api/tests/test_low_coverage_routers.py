"""Batch 15 — Router coverage for knowledge articles and reports."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from star_itsm_api.core.security import ROLE_SUBMITTER, get_current_user
from star_itsm_api.main import app
from star_itsm_api.schemas.analytics import AnalyticsResponse
from star_itsm_api.schemas.custom_reports import CustomReportResponse, PredefinedReportsResponse
from star_itsm_api.schemas.dashboard import DashboardRead
from star_itsm_api.schemas.report import StandardReportRead


@pytest.mark.asyncio
async def test_knowledge_articles_list_portal(api_client: AsyncClient) -> None:
    with patch(
        "star_itsm_api.routers.knowledge_articles.list_knowledge_articles",
        new_callable=AsyncMock,
        return_value=[],
    ):
        response = await api_client.get("/api/v1/knowledge-articles?portal=true")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_knowledge_articles_list_staff(api_client: AsyncClient) -> None:
    with patch(
        "star_itsm_api.routers.knowledge_articles.list_knowledge_articles",
        new_callable=AsyncMock,
        return_value=[],
    ):
        response = await api_client.get("/api/v1/knowledge-articles?status=published")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_knowledge_articles_list_forbidden_for_submitter(api_client: AsyncClient) -> None:
    app.dependency_overrides[get_current_user] = lambda: MagicMock(
        id=uuid.uuid4(),
        role=ROLE_SUBMITTER,
        is_active=True,
    )
    try:
        response = await api_client.get("/api/v1/knowledge-articles")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_knowledge_articles_get_not_found(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    article_id = uuid.uuid4()
    with patch(
        "star_itsm_api.routers.knowledge_articles.get_knowledge_article",
        new_callable=AsyncMock,
        return_value=None,
    ):
        response = await api_client.get(f"/api/v1/knowledge-articles/{article_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_knowledge_articles_list_internal_error(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    with patch(
        "star_itsm_api.routers.knowledge_articles.list_knowledge_articles",
        new_callable=AsyncMock,
        side_effect=RuntimeError("db"),
    ):
        response = await api_client.get("/api/v1/knowledge-articles?status=draft")
    assert response.status_code == 500
    override_db.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_reports_dashboard_invalid_scope(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/reports/dashboard?scope=invalid-scope")
    assert response.status_code == 400
    assert "Invalid scope" in response.json()["detail"]


@pytest.mark.asyncio
async def test_reports_dashboard_success(api_client: AsyncClient) -> None:
    now = datetime.now(UTC)
    dashboard = DashboardRead(
        generated_at=now,
        open_count=0,
        closed_count=0,
        major_open_count=0,
        sla_overdue_count=0,
        sla_due_soon_count=0,
        opened_last_7_days=0,
        closed_last_7_days=0,
        resolution_rate_pct=0.0,
    )
    with patch(
        "star_itsm_api.routers.reports.build_dashboard",
        new_callable=AsyncMock,
        return_value=dashboard,
    ):
        response = await api_client.get("/api/v1/reports/dashboard")
    assert response.status_code == 200
    assert response.json()["open_count"] == 0


@pytest.mark.asyncio
async def test_reports_standard_success(api_client: AsyncClient) -> None:
    now = datetime.now(UTC)
    report = StandardReportRead(
        generated_at=now,
        period_days=30,
        total_tickets=0,
        buckets=[],
    )
    with patch(
        "star_itsm_api.routers.reports.build_standard_report",
        new_callable=AsyncMock,
        return_value=report,
    ):
        response = await api_client.get("/api/v1/reports/standard?period_days=30")
    assert response.status_code == 200
    assert response.json()["period_days"] == 30


@pytest.mark.asyncio
async def test_reports_analytics_success(api_client: AsyncClient) -> None:
    analytics = AnalyticsResponse(hotspots=[], heatmap=[], risk_tickets=[])
    with patch(
        "star_itsm_api.routers.reports.build_analytics",
        new_callable=AsyncMock,
        return_value=analytics,
    ):
        response = await api_client.get("/api/v1/reports/analytics")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_reports_custom_success(api_client: AsyncClient) -> None:
    now = datetime.now(UTC)
    custom = CustomReportResponse(
        generated_at=now,
        group_by="status",
        total_tickets=0,
        groups=[],
    )
    with patch(
        "star_itsm_api.routers.reports.build_custom_report",
        new_callable=AsyncMock,
        return_value=custom,
    ):
        response = await api_client.get("/api/v1/reports/custom?group_by=status")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_reports_predefined_success(api_client: AsyncClient) -> None:
    now = datetime.now(UTC)
    predefined = PredefinedReportsResponse(generated_at=now, sections=[])
    with patch(
        "star_itsm_api.routers.reports.build_predefined_reports",
        new_callable=AsyncMock,
        return_value=predefined,
    ):
        response = await api_client.get("/api/v1/reports/predefined")
    assert response.status_code == 200
