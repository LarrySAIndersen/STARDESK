from star_itsm_api.services.slack_mock import MOCK_SLACK_CHANNELS, get_mock_channel


def test_get_mock_channel_found() -> None:
    # Test with a valid channel ID
    channel = get_mock_channel("C_MOCK_IT_SUPPORT")
    assert channel is not None
    assert channel["name"] == "it-support"


def test_get_mock_channel_not_found() -> None:
    # Test with an invalid channel ID
    channel = get_mock_channel("INVALID_CHANNEL_ID")
    assert channel is None
