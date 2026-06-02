import re
from datetime import date

_CPR_IN_TEXT = re.compile(
    r"(?<!\d)"
    r"(0[1-9]|[12]\d|3[01])"
    r"(0[1-9]|1[0-2])"
    r"(\d{2})"
    r"[-\s]?"
    r"(\d{4})"
    r"(?!\d)",
)


def normalize_cpr(value: str) -> str:
    digits = re.sub(r"\D", "", value.strip())
    if len(digits) != 10:
        raise ValueError("CPR-nummer skal have 10 cifre")
    return f"{digits[0:6]}-{digits[6:10]}"


def _valid_date(dd: int, mm: int, yy: int) -> bool:
    year = 1900 + yy if yy >= 37 else 2000 + yy
    try:
        date(year, mm, dd)
    except ValueError:
        return False
    return True


def validate_cpr(value: str) -> str:
    """Validate and return normalized CPR (DDMMYY-XXXX)."""
    digits = re.sub(r"\D", "", value.strip())
    if len(digits) != 10:
        raise ValueError("Ugyldigt CPR-nummer (format: DDMMYY-XXXX)")
    dd, mm, yy = int(digits[0:2]), int(digits[2:4]), int(digits[4:6])
    if not _valid_date(dd, mm, yy):
        raise ValueError("Ugyldig dato i CPR-nummer")
    return normalize_cpr(digits)


def mask_cpr(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    if len(digits) != 10:
        return "******-****"
    return f"{digits[0:6]}-****"


def text_contains_cpr(text: str) -> bool:
    return _CPR_IN_TEXT.search(text) is not None


def assert_no_cpr_outside_field(*, subject_cpr: str | None, title: str, description: str) -> None:
    """CPR must only be entered in the dedicated field."""
    _ = subject_cpr
    for label, content in (("titel", title), ("beskrivelse", description)):
        if text_contains_cpr(content):
            raise ValueError(
                f"CPR-nummer må ikke stå i {label}. Brug feltet 'CPR-nummer' i stedet."
            )
