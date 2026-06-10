from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient, Response


@pytest.mark.asyncio
async def test_chat_smart_mock_fallback_no_key(client: AsyncClient) -> None:
    # Ensure GOOGLE_KEY and GEMINI_API_KEY are not in env
    with patch.dict("os.environ", {}, clear=True):
        payload = {
            "messages": [
                {"role": "user", "content": "hjælp mig med vpn"}
            ],
        }

        # Patch the database search functions
        with patch(
            "star_itsm_api.routers.chat.search_knowledge_articles",
            AsyncMock(return_value="### VPN Guide\nBeskrivelse: Forbind til VPN")
        ) as mock_search, patch(
            "star_itsm_api.routers.chat.search_historical_solutions",
            AsyncMock(return_value="Ingen historiske løsninger fundet")
        ) as mock_solutions_search:
            response = await client.post("/api/v1/chat", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert "VPN" in data["response"]
            assert "Forbind til VPN" in data["response"]
            mock_search.assert_called_with("vpn")
            mock_solutions_search.assert_called_with("vpn")


@pytest.mark.asyncio
async def test_chat_smart_mock_fallback_sager(client: AsyncClient) -> None:
    with patch.dict("os.environ", {}, clear=True):
        payload = {
            "messages": [
                {"role": "user", "content": "vis mine sager"}
            ],
        }

        with patch(
            "star_itsm_api.routers.chat.get_user_tickets",
            AsyncMock(return_value="Sagsnr: 12345 (Aktiv)")
        ) as mock_tickets:
            response = await client.post("/api/v1/chat", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert "12345" in data["response"]
            mock_tickets.assert_called_once()
            assert mock_tickets.call_args.args[0] == "admin@example.dk"


@pytest.mark.asyncio
async def test_chat_smart_mock_fallback_categories(client: AsyncClient) -> None:
    with patch.dict("os.environ", {}, clear=True):
        payload = {
            "messages": [
                {"role": "user", "content": "vis kategorier"}
            ],
        }

        with patch(
            "star_itsm_api.routers.chat.get_ticket_categories",
            AsyncMock(return_value="Kategori: IT-Support")
        ) as mock_cats:
            response = await client.post("/api/v1/chat", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert "IT-Support" in data["response"]
            mock_cats.assert_called_once()


@pytest.mark.asyncio
async def test_chat_smart_mock_fallback_generic(client: AsyncClient) -> None:
    with patch.dict("os.environ", {}, clear=True):
        payload = {
            "messages": [
                {"role": "user", "content": "hjælp mig emd ost"}
            ],
        }

        with patch(
            "star_itsm_api.routers.chat.search_knowledge_articles",
            AsyncMock(return_value="Ingen vidensartikler fundet")
        ), patch(
            "star_itsm_api.routers.chat.search_historical_solutions",
            AsyncMock(return_value="Ingen historiske løsninger fundet")
        ):
            response = await client.post("/api/v1/chat", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert "Da der ikke er konfigureret en aktiv `GOOGLE_KEY`" in data["response"]
            assert "vpn" in data["response"].lower()


@pytest.mark.asyncio
async def test_chat_smart_mock_fallback_create_ticket(client: AsyncClient) -> None:
    with patch.dict("os.environ", {}, clear=True):
        payload = {
            "messages": [
                {"role": "user", "content": "opret sag: Min computer er i brand - Den ryger meget og lugter grimt"}
            ],
        }

        with patch(
            "star_itsm_api.routers.chat.create_ticket",
            AsyncMock(return_value="Sagen blev oprettet med succes!\n\n**Sagsnummer:** INC-2026-00001")
        ) as mock_create:
            response = await client.post("/api/v1/chat", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert "Sagen blev oprettet med succes" in data["response"]
            mock_create.assert_called_once()
            assert mock_create.call_args.kwargs["title"] == "Min computer er i brand"
            assert mock_create.call_args.kwargs["description"] == "Den ryger meget og lugter grimt"
            assert mock_create.call_args.kwargs["caller"] is not None



@pytest.mark.asyncio
async def test_chat_gemini_api_call_success(client: AsyncClient) -> None:
    # Test with GOOGLE_KEY present
    with patch.dict("os.environ", {"GOOGLE_KEY": "fake-google-key"}):
        payload = {
            "messages": [
                {"role": "user", "content": "Hej med dig"}
            ],
        }

        # Mock Gemini API response
        mock_response_json = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "Hej! Jeg er din assistent. Hvad kan jeg hjælpe med?"}
                        ]
                    }
                }
            ]
        }

        # Patch httpx.AsyncClient.post to intercept only Gemini calls
        original_post = AsyncClient.post

        async def mock_post_fn(self, url, *args, **kwargs):
            if "generativelanguage.googleapis.com" in str(url):
                import httpx as httpx_mod
                req = httpx_mod.Request("POST", url)
                return Response(200, json=mock_response_json, request=req)
            return await original_post(self, url, *args, **kwargs)

        with patch("httpx.AsyncClient.post", mock_post_fn):
            response = await client.post("/api/v1/chat", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["response"] == "Hej! Jeg er din assistent. Hvad kan jeg hjælpe med?"


@pytest.mark.asyncio
async def test_chat_gemini_api_call_rate_limited(client: AsyncClient) -> None:
    # Test that a 429 rate limit from Gemini falls back to the smart mock instead of throwing a 502
    with patch.dict("os.environ", {"GOOGLE_KEY": "fake-google-key"}):
        payload = {
            "messages": [
                {"role": "user", "content": "vis mine sager"}
            ],
        }

        original_post = AsyncClient.post

        async def mock_post_fn(self, url, *args, **kwargs):
            if "generativelanguage.googleapis.com" in str(url):
                import httpx as httpx_mod
                req = httpx_mod.Request("POST", url)
                return Response(429, text="Too Many Requests", request=req)
            return await original_post(self, url, *args, **kwargs)

        with patch("httpx.AsyncClient.post", mock_post_fn):
            with patch(
                "star_itsm_api.routers.chat.get_user_tickets",
                AsyncMock(return_value="Sagsnr: 12345 (Aktiv)")
            ) as mock_tickets:
                response = await client.post("/api/v1/chat", json=payload)
                assert response.status_code == 200
                data = response.json()
                assert "Sprogmodellen er midlertidigt overbelastet" in data["response"]
                assert "12345" in data["response"]
                mock_tickets.assert_called_once()


@pytest.mark.asyncio
async def test_chat_router_custom_router_uses_env_not_client_url(client: AsyncClient) -> None:
    payload = {
        "messages": [{"role": "user", "content": "Hej"}],
        "model_override": "custom-router",
        "custom_router_url": "ftp://malicious.com/api",
    }
    mock_res_json = {"choices": [{"message": {"content": "Svar fra custom router"}}]}
    original_post = AsyncClient.post
    captured_urls: list[str] = []

    async def mock_post_fn(self, url, *args, **kwargs):
        captured_urls.append(str(url))
        if "openrouter.ai" in str(url):
            import httpx as httpx_mod
            req = httpx_mod.Request("POST", url)
            return Response(200, json=mock_res_json, request=req)
        return await original_post(self, url, *args, **kwargs)

    with patch("httpx.AsyncClient.post", mock_post_fn):
        response = await client.post("/api/v1/chat", json=payload)

    assert response.status_code == 200
    assert any("openrouter.ai" in url for url in captured_urls)
    assert not any("malicious.com" in url for url in captured_urls)


@pytest.mark.asyncio
async def test_chat_router_model_override_invalid(client: AsyncClient) -> None:
    with patch.dict("os.environ", {"GOOGLE_KEY": "fake-google-key"}):
        payload = {
            "messages": [{"role": "user", "content": "Hej"}],
            "model_override": "../../../../malicious/model"
        }
        response = await client.post("/api/v1/chat", json=payload)
        assert response.status_code == 400
        assert "Ugyldigt modelnavn" in response.json()["detail"]


@pytest.mark.asyncio
async def test_chat_router_custom_url_reconstruction_success(client: AsyncClient) -> None:
    payload = {
        "messages": [{"role": "user", "content": "Hej"}],
        "model_override": "custom-router",
    }
    # Mock post response
    mock_res_json = {
        "choices": [
            {"message": {"content": "Svar fra custom router"}}
        ]
    }
    original_post = AsyncClient.post

    async def mock_post_fn(self, url, *args, **kwargs):
        if "openrouter.ai" in str(url):
            import httpx as httpx_mod
            req = httpx_mod.Request("POST", url)
            return Response(200, json=mock_res_json, request=req)
        return await original_post(self, url, *args, **kwargs)

    with patch("httpx.AsyncClient.post", mock_post_fn):
        response = await client.post("/api/v1/chat", json=payload)
        assert response.status_code == 200
        assert response.json()["response"] == "Svar fra custom router"


@pytest.mark.asyncio
async def test_execute_tool_search_historical_solutions() -> None:
    from star_itsm_api.routers.chat import execute_tool
    from tests.conftest import FAKE_ADMIN
    with patch(
        "star_itsm_api.routers.chat.search_historical_solutions",
        AsyncMock(return_value="### Test Solution\n**Løsningsresumé:** Nulstil VPN")
    ) as mock_search:
        res = await execute_tool("search_historical_solutions", {"query": "vpn"}, FAKE_ADMIN)
        assert "Test Solution" in res
        assert "Nulstil VPN" in res
        mock_search.assert_called_once_with("vpn")


@pytest.mark.asyncio
async def test_execute_tool_create_ticket() -> None:
    from star_itsm_api.routers.chat import execute_tool
    from tests.conftest import FAKE_ADMIN
    with patch(
        "star_itsm_api.routers.chat.create_ticket",
        AsyncMock(return_value="Sagen blev oprettet med succes!\n\n**Sagsnummer:** INC-2026-00001")
    ) as mock_create:
        res = await execute_tool(
            "create_ticket",
            {
                "title": "Test sag",
                "description": "Dette er en test beskrivelse",
            },
            FAKE_ADMIN,
        )
        assert "Sagen blev oprettet med succes" in res
        assert "INC-2026-00001" in res
        mock_create.assert_called_once()
        assert mock_create.call_args.kwargs["caller"] is FAKE_ADMIN
        assert mock_create.call_args.kwargs["title"] == "Test sag"



@pytest.mark.asyncio
async def test_chat_router_openai_success(client: AsyncClient) -> None:
    payload = {
        "messages": [{"role": "user", "content": "Hej"}],
        "model_override": "gpt-4o",
    }
    mock_res_json = {
        "choices": [
            {"message": {"content": "Svar fra OpenAI"}}
        ]
    }
    original_post = AsyncClient.post

    async def mock_post_fn(self, url, *args, **kwargs):
        if "api.openai.com" in str(url):
            import httpx as httpx_mod
            req = httpx_mod.Request("POST", url)
            return Response(200, json=mock_res_json, request=req)
        return await original_post(self, url, *args, **kwargs)

    with patch.dict("os.environ", {"OPENAI_API_KEY": "fake-openai-key"}, clear=True):
        with patch("httpx.AsyncClient.post", mock_post_fn):
            response = await client.post("/api/v1/chat", json=payload)
            assert response.status_code == 200
            assert response.json()["response"] == "Svar fra OpenAI"


@pytest.mark.asyncio
async def test_chat_router_openai_fallback_no_key(client: AsyncClient) -> None:
    with patch.dict("os.environ", {}, clear=True):
        payload = {
            "messages": [{"role": "user", "content": "hjælp med vpn"}],
            "model_override": "gpt-4o"
        }
        with patch(
            "star_itsm_api.routers.chat.search_knowledge_articles",
            AsyncMock(return_value="### VPN Guide\nBeskrivelse: Forbind til VPN")
        ), patch(
            "star_itsm_api.routers.chat.search_historical_solutions",
            AsyncMock(return_value="Ingen historiske løsninger fundet")
        ):
            response = await client.post("/api/v1/chat", json=payload)
            assert response.status_code == 200
            assert "VPN" in response.json()["response"]


@pytest.mark.asyncio
async def test_chat_router_anthropic_success(client: AsyncClient) -> None:
    payload = {
        "messages": [{"role": "user", "content": "Hej"}],
        "model_override": "claude-3-5-sonnet-20241022",
    }
    mock_res_json = {
        "content": [
            {"text": "Svar fra Anthropic"}
        ]
    }
    original_post = AsyncClient.post

    async def mock_post_fn(self, url, *args, **kwargs):
        if "api.anthropic.com" in str(url):
            import httpx as httpx_mod
            req = httpx_mod.Request("POST", url)
            return Response(200, json=mock_res_json, request=req)
        return await original_post(self, url, *args, **kwargs)

    with patch.dict("os.environ", {"ANTHROPIC_API_KEY": "fake-anthropic-key"}, clear=True):
        with patch("httpx.AsyncClient.post", mock_post_fn):
            response = await client.post("/api/v1/chat", json=payload)
            assert response.status_code == 200
            assert response.json()["response"] == "Svar fra Anthropic"


@pytest.mark.asyncio
async def test_chat_router_anthropic_fallback_no_key(client: AsyncClient) -> None:
    with patch.dict("os.environ", {}, clear=True):
        payload = {
            "messages": [{"role": "user", "content": "hjælp med vpn"}],
            "model_override": "claude-3-5-sonnet-20241022"
        }
        with patch(
            "star_itsm_api.routers.chat.search_knowledge_articles",
            AsyncMock(return_value="### VPN Guide\nBeskrivelse: Forbind til VPN")
        ), patch(
            "star_itsm_api.routers.chat.search_historical_solutions",
            AsyncMock(return_value="Ingen historiske løsninger fundet")
        ):
            response = await client.post("/api/v1/chat", json=payload)
            assert response.status_code == 200
            assert "VPN" in response.json()["response"]
