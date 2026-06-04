import pytest
from fastapi import HTTPException

from star_itsm_api.services.ticket_security import (
    require_staff_for_security_metadata_update,
    resolve_create_security_flag,
)
from tests.support.users import make_test_user


def test_resolve_create_security_flag_false_for_all_roles() -> None:
    user = make_test_user(role="end_user")
    assert resolve_create_security_flag(user, False) is False
    assert resolve_create_security_flag(make_test_user(role="admin"), False) is False


def test_resolve_create_security_flag_staff() -> None:
    assert resolve_create_security_flag(make_test_user(role="admin"), True) is True
    assert resolve_create_security_flag(make_test_user(role="agent"), True) is True


def test_resolve_create_security_flag_submitter_forbidden() -> None:
    with pytest.raises(HTTPException) as exc:
        resolve_create_security_flag(make_test_user(role="end_user"), True)
    assert exc.value.status_code == 403


def test_require_staff_for_security_metadata_update_ignores_absent_field() -> None:
    require_staff_for_security_metadata_update(make_test_user(role="end_user"), {"tags": ["x"]})


def test_require_staff_for_security_metadata_update_submitter_forbidden() -> None:
    with pytest.raises(HTTPException) as exc:
        require_staff_for_security_metadata_update(
            make_test_user(role="end_user"),
            {"is_security_ticket": True},
        )
    assert exc.value.status_code == 403


def test_require_staff_for_security_metadata_update_staff_ok() -> None:
    require_staff_for_security_metadata_update(
        make_test_user(role="agent"),
        {"is_security_ticket": False},
    )
