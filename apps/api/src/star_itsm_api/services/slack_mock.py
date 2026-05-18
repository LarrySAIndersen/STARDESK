"""Mock Slack channel catalog until real workspace integration."""

from typing import TypedDict


class MockSlackChannel(TypedDict):
    channel_id: str
    name: str
    display_name_da: str
    is_private: bool


MOCK_SLACK_CHANNELS: list[MockSlackChannel] = [
    {
        "channel_id": "C_MOCK_IT_SUPPORT",
        "name": "it-support",
        "display_name_da": "IT-support",
        "is_private": False,
    },
    {
        "channel_id": "C_MOCK_DRIFT",
        "name": "drift",
        "display_name_da": "Drift",
        "is_private": False,
    },
    {
        "channel_id": "C_MOCK_STAR_ALERTS",
        "name": "star-alerts",
        "display_name_da": "STAR-alerts",
        "is_private": False,
    },
    {
        "channel_id": "C_MOCK_MAJOR_INCIDENTS",
        "name": "major-incidents",
        "display_name_da": "Større hændelser",
        "is_private": True,
    },
]


def get_mock_channel(channel_id: str) -> MockSlackChannel | None:
    for channel in MOCK_SLACK_CHANNELS:
        if channel["channel_id"] == channel_id:
            return channel
    return None
