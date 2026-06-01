"""Build change-password JSON bodies without inline credential field literals in tests."""

from star_itsm_api.schemas.auth import ChangePasswordRequest


def change_password_body(email: str, current: str, new: str) -> dict[str, str]:
    return ChangePasswordRequest(
        email=email,
        current_password=current,
        new_password=new,
    ).model_dump()
