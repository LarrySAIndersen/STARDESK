from httpx import AsyncClient


async def test_list_tickets_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/tickets")
    assert response.status_code == 503
