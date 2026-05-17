from httpx import AsyncClient


async def test_list_teams_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/teams")
    assert response.status_code == 503
