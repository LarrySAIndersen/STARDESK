import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
THEME_MODES = frozenset({"light", "dark"})
VALID_PRESET_IDS = frozenset(
    {
        "star-standard",
        "ocean",
        "forest",
        "slate",
        "plum",
        "sunset",
        "high-contrast",
        "midnight",
    }
)

ThemeMode = Literal["light", "dark"]
ThemeSlot = Literal["primary", "secondary", "background", "surface", "accent"]


class ThemePaletteSlotOverrides(BaseModel):
    primary: str | None = None
    secondary: str | None = None
    background: str | None = None
    surface: str | None = None
    accent: str | None = None

    @field_validator("primary", "secondary", "background", "surface", "accent")
    @classmethod
    def validate_hex(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not HEX_COLOR.match(normalized):
            raise ValueError("Farver skal angives som #RRGGBB")
        return normalized.lower()


class ThemePalettePreference(BaseModel):
    preset_id: str = Field(default="star-standard", max_length=64)
    overrides: dict[ThemeMode, ThemePaletteSlotOverrides] | None = None

    @field_validator("preset_id")
    @classmethod
    def validate_preset(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_PRESET_IDS:
            raise ValueError("Ukendt farvetema")
        return normalized

    @field_validator("overrides")
    @classmethod
    def validate_override_modes(
        cls,
        value: dict[ThemeMode, ThemePaletteSlotOverrides] | None,
    ) -> dict[ThemeMode, ThemePaletteSlotOverrides] | None:
        if value is None:
            return None
        unknown = set(value.keys()) - THEME_MODES
        if unknown:
            raise ValueError("Overrides skal bruge light eller dark")
        return value


class ThemePaletteUpdateRequest(BaseModel):
    preset_id: str | None = None
    overrides: dict[ThemeMode, ThemePaletteSlotOverrides] | None = None
