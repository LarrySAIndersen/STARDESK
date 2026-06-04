from httpx import AsyncClient


async def test_standard_report_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/standard")
    assert response.status_code == 503


async def test_dashboard_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/dashboard")
    assert response.status_code == 503


async def test_dashboard_invalid_scope_returns_400(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/dashboard?scope=invalid")
    assert response.status_code in (400, 503)


async def test_custom_report_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/custom")
    assert response.status_code == 503


async def test_custom_report_export_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/custom/export")
    assert response.status_code == 503


async def test_predefined_reports_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/predefined")
    assert response.status_code == 503

