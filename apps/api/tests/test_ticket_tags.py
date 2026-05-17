import pytest

from star_itsm_api.services.ticket_tags import (
    ALLOWED_TICKET_EMOJIS,
    normalize_tags,
    parse_tags_string,
    validate_emoji,
)


def test_normalize_tags_dedupes_and_lowercases() -> None:
    assert normalize_tags(["VPN", "vpn", "  Printer "]) == ["vpn", "printer"]


def test_parse_tags_string() -> None:
    assert parse_tags_string("adgang, printer; VPN") == ["adgang", "printer", "vpn"]


def test_validate_emoji_allowed() -> None:
    sample = next(iter(ALLOWED_TICKET_EMOJIS))
    assert validate_emoji(sample) == sample
    assert validate_emoji(None) is None


def test_validate_emoji_rejects_unknown() -> None:
    with pytest.raises(ValueError):
        validate_emoji("🎉")
