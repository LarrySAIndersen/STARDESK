import pytest

from star_itsm_api.services.slack import SlackApiError, post_ticket_message


class _FakeResponse:
    def __init__(self, status_code: int, data: dict):
        self.status_code = status_code
        self._data = data

    def json(self) -> dict:
        return self._data


class _FakeAsyncClient:
    def __init__(self, *, response: _FakeResponse):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, *args, **kwargs):  # noqa: ANN002, ANN003
        return self._response


@pytest.mark.asyncio
async def test_post_ticket_message_success(monkeypatch: pytest.MonkeyPatch) -> None:
    import star_itsm_api.services.slack as slack_service

    response = _FakeResponse(200, {"ok": True, "channel": "C123", "ts": "171234.000001"})
    monkeypatch.setattr(
        slack_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(response=response),
    )

    posted = await post_ticket_message(
        bot_token="xoxb-test",
        channel_id="C123",
        text="Ticket besked",
    )

    assert posted.channel_id == "C123"
    assert posted.ts == "171234.000001"


@pytest.mark.asyncio
async def test_post_ticket_message_raises_on_slack_error(monkeypatch: pytest.MonkeyPatch) -> None:
    import star_itsm_api.services.slack as slack_service

    response = _FakeResponse(200, {"ok": False, "error": "channel_not_found"})
    monkeypatch.setattr(
        slack_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(response=response),
    )

    with pytest.raises(SlackApiError, match="channel_not_found"):
        await post_ticket_message(
            bot_token="xoxb-test",
            channel_id="C404",
            text="Ticket besked",
        )
