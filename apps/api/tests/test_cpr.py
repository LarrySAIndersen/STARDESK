import pytest

from star_itsm_api.services.cpr import (
    assert_no_cpr_outside_field,
    mask_cpr,
    text_contains_cpr,
    validate_cpr,
)


def test_validate_cpr_normalizes() -> None:
    assert validate_cpr("010190-1234") == "010190-1234"
    assert validate_cpr("0101901234") == "010190-1234"


def test_validate_cpr_rejects_invalid_date() -> None:
    with pytest.raises(ValueError, match="dato"):
        validate_cpr("310299-1234")


def test_text_contains_cpr() -> None:
    assert text_contains_cpr("Kontakt CPR 010190-1234 for info")
    assert not text_contains_cpr("Ingen personnumre her")


def test_assert_no_cpr_in_title() -> None:
    with pytest.raises(ValueError, match="titel"):
        assert_no_cpr_outside_field(
            subject_cpr=None,
            title="CPR 010190-1234",
            description="Beskrivelse uden nummer",
        )


def test_mask_cpr() -> None:
    assert mask_cpr("010190-1234") == "010190-****"
    assert mask_cpr(None) is None
    assert mask_cpr("") is None
    assert mask_cpr("1234") == "******-****"


def test_normalize_cpr_invalid_length() -> None:
    from star_itsm_api.services.cpr import normalize_cpr
    with pytest.raises(ValueError, match="CPR-nummer skal have 10 cifre"):
        normalize_cpr("1234")


def test_validate_cpr_invalid_length() -> None:
    with pytest.raises(ValueError, match="Ugyldigt CPR-nummer"):
        validate_cpr("1234")

