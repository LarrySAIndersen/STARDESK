from httpx import AsyncClient


async def test_standard_report_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/standard")
    assert response.status_code == 503


async def test_dashboard_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/dashboard")
    assert response.status_code == 503
