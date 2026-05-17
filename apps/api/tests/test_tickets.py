from httpx import AsyncClient


async def test_list_tickets_returns_empty_without_database(client: AsyncClient) -> None:
    response = await client.get("/api/v1/tickets")
    assert response.status_code == 200
    assert response.json() == []
