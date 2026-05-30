"""CORS preflight for Work Board canvas sync (bulk-import)."""

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.main import app


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "origin",
    [
        "null",
        "vscode-webview://webview-id",
        "vscode-file://vscode-app",
        "https://cursor.com",
        "https://www.cursor.com",
        "https://app.cursor.sh",
    ],
)
async def test_workboard_bulk_import_preflight_allows_canvas_origins(origin: str) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.options(
            "/api/v1/workboard/tasks/bulk-import",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin
