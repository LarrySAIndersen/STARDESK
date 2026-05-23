import re

# Min 8 chars; letters (any case) and digits only — no special characters required.
PASSWORD_PATTERN = re.compile(r"^[a-zA-Z0-9]{8,}$")
PASSWORD_VALIDATION_MESSAGE = (
    "Adgangskoden skal være mindst 8 tegn og må kun indeholde bogstaver og tal"
)


def validate_password(password: str) -> None:
    if not PASSWORD_PATTERN.fullmatch(password):
        raise ValueError(PASSWORD_VALIDATION_MESSAGE)


def effective_must_change_password(user) -> bool:  # noqa: ANN001
    """Whether the client should treat the user as needing a password change."""
    if getattr(user, "password_policy_exempt", False):
        return False
    return bool(getattr(user, "must_change_password", False))


def validate_password_for_user(user, password: str) -> None:  # noqa: ANN001
    if getattr(user, "password_policy_exempt", False):
        return
    validate_password(password)
