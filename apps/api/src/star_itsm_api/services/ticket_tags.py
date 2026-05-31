import re

# Curated set for ITSM — must match frontend TICKET_EMOJI_OPTIONS
ALLOWED_TICKET_EMOJIS: frozenset[str] = frozenset(
    {
        "🔥",
        "⚠️",
        "🛠️",
        "💻",
        "📞",
        "🔒",
        "📎",
        "✅",
        "🚀",
        "❓",
    }
)

_TAG_PATTERN = re.compile(r"^[a-z0-9æøåÆØÅ][a-z0-9æøåÆØÅ\-_.]{0,31}$", re.IGNORECASE)
_MAX_TAGS = 10


def normalize_tags(raw: list[str] | None) -> list[str]:
    if not raw:
        return []
    seen: set[str] = set()
    result: list[str] = []
    for item in raw:
        tag = item.strip().lower()
        if not tag or tag in seen:
            continue
        if not _TAG_PATTERN.match(tag):
            raise ValueError(f"Ugyldigt tag «{item}». Brug 2–32 tegn: bogstaver, tal, bindestreg.")
        seen.add(tag)
        result.append(tag)
        if len(result) >= _MAX_TAGS:
            break
    return result


def parse_tags_string(value: str | None) -> list[str]:
    if not value or not value.strip():
        return []
    parts = re.split(r"[,;]+", value)
    return normalize_tags(parts)


def validate_emoji(value: str | None) -> str | None:
    if value is None or not str(value).strip():
        return None
    emoji = str(value).strip()
    if emoji not in ALLOWED_TICKET_EMOJIS:
        raise ValueError("Vælg en emoji fra listen")
    return emoji
