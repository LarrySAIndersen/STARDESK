from star_itsm_api.core.security import ROLE_AGENT, ROLE_SUBMITTER
from star_itsm_api.services import user_import


def test_normalize_import_role_aliases_danish() -> None:
    assert (
        user_import.normalize_import_role("sagsbehandler", default_role=ROLE_SUBMITTER)
        == ROLE_AGENT
    )
    assert user_import.normalize_import_role("", default_role=ROLE_SUBMITTER) == ROLE_SUBMITTER


def test_normalize_import_role_unknown_returns_none() -> None:
    assert user_import.normalize_import_role("not-a-role", default_role=ROLE_AGENT) is None


def test_parse_import_is_active_truthy_values() -> None:
    assert user_import.parse_import_is_active("ja") is True
    assert user_import.parse_import_is_active("AKTIV") is True
    assert user_import.parse_import_is_active(True) is True


def test_parse_import_is_active_falsey_values() -> None:
    assert user_import.parse_import_is_active("nej") is False
    assert user_import.parse_import_is_active("inaktiv") is False


def test_parse_import_is_active_default() -> None:
    assert user_import.parse_import_is_active(None, default=False) is False
    assert user_import.parse_import_is_active("maybe", default=True) is True
