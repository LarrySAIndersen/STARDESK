from pathlib import Path
from unittest.mock import patch

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
         patch("builtins.open", create=True) as mock_open, \
         patch("json.load") as mock_json_load:
        
        mock_exists.return_value = True
        mock_json_load.return_value = dummy_sbom
        
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
