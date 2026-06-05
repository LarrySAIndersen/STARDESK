from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_sbom_endpoint_success(client: AsyncClient) -> None:
    # Ensure sbom.json exists or mock its existence and content
    dummy_sbom = {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "version": 1,
        "components": []
    }
    
    with patch("star_itsm_api.routers.platform.Path.exists") as mock_exists, \
         patch("star_itsm_api.routers.platform.anyio.open_file") as mock_open:
        
        mock_exists.return_value = True
        
        mock_file = AsyncMock()
        mock_file.read = AsyncMock(return_value='{"bomFormat": "CycloneDX", "specVersion": "1.5", "version": 1, "components": []}')
        
        mock_cm = AsyncMock()
        mock_cm.__aenter__.return_value = mock_file
        mock_open.return_value = mock_cm
        
        response = await client.get("/api/v1/platform/sbom")
        assert response.status_code == 200
        assert response.json() == dummy_sbom


@pytest.mark.asyncio
async def test_sbom_endpoint_not_found(client: AsyncClient) -> None:
    with patch("star_itsm_api.routers.platform.Path.exists") as mock_exists:
        mock_exists.return_value = False
        
        response = await client.get("/api/v1/platform/sbom")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower() or "ikke fundet" in response.json()["detail"].lower()
