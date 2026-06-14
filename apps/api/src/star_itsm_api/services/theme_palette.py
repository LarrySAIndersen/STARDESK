"""Theme palette validation (WCAG AA contrast blocking)."""

from __future__ import annotations

from star_itsm_api.schemas.theme_palette import (
    ThemePalettePreference,
    ThemePaletteSlotOverrides,
    ThemePaletteUpdateRequest,
    VALID_PRESET_IDS,
)

SLOT_LABELS = {
    "primary": "Primær",
    "secondary": "Sekundær",
    "background": "Baggrund",
    "surface": "Overflade",
    "accent": "Accent",
}

PRESET_LIGHT: dict[str, dict[str, str]] = {
    "star-standard": {
        "primary": "#1b3a6b",
        "secondary": "#3b5a95",
        "background": "#f2f2ef",
        "surface": "#ffffff",
        "accent": "#e8eef7",
    },
    "ocean": {
        "primary": "#0d5c7a",
        "secondary": "#2a8fad",
        "background": "#eef6f8",
        "surface": "#ffffff",
        "accent": "#d9eef5",
    },
    "forest": {
        "primary": "#1a5c3a",
        "secondary": "#2f8f5c",
        "background": "#eef5f0",
        "surface": "#ffffff",
        "accent": "#dceee3",
    },
    "slate": {
        "primary": "#334155",
        "secondary": "#64748b",
        "background": "#f1f5f9",
        "surface": "#ffffff",
        "accent": "#e2e8f0",
    },
    "plum": {
        "primary": "#5a3d7a",
        "secondary": "#7c5aa0",
        "background": "#f3eff7",
        "surface": "#ffffff",
        "accent": "#ebe3f3",
    },
    "sunset": {
        "primary": "#9a4d2e",
        "secondary": "#c4724a",
        "background": "#faf3ee",
        "surface": "#ffffff",
        "accent": "#f5e4d9",
    },
    "high-contrast": {
        "primary": "#0b1f44",
        "secondary": "#1f3f7a",
        "background": "#ffffff",
        "surface": "#f8fafc",
        "accent": "#dbeafe",
    },
    "midnight": {
        "primary": "#152a52",
        "secondary": "#2f4f86",
        "background": "#e9edf5",
        "surface": "#ffffff",
        "accent": "#d5dff0",
    },
}

PRESET_DARK: dict[str, dict[str, str]] = {
    "star-standard": {
        "primary": "#5b82c4",
        "secondary": "#7ba3d4",
        "background": "#0c1018",
        "surface": "#161d28",
        "accent": "#243248",
    },
    "ocean": {
        "primary": "#4db8d9",
        "secondary": "#6ecae6",
        "background": "#081318",
        "surface": "#101d24",
        "accent": "#1a3340",
    },
    "forest": {
        "primary": "#4db87a",
        "secondary": "#6fd69a",
        "background": "#081410",
        "surface": "#101f18",
        "accent": "#1a3328",
    },
    "slate": {
        "primary": "#94a3b8",
        "secondary": "#cbd5e1",
        "background": "#0c1018",
        "surface": "#161d28",
        "accent": "#243044",
    },
    "plum": {
        "primary": "#b794e8",
        "secondary": "#d4b8f5",
        "background": "#100c18",
        "surface": "#1a1428",
        "accent": "#2d2440",
    },
    "sunset": {
        "primary": "#e8a07a",
        "secondary": "#f0b89a",
        "background": "#140e0a",
        "surface": "#221812",
        "accent": "#3d2a20",
    },
    "high-contrast": {
        "primary": "#8eb4ff",
        "secondary": "#b8d0ff",
        "background": "#000000",
        "surface": "#111111",
        "accent": "#1f2a44",
    },
    "midnight": {
        "primary": "#6b8fd4",
        "secondary": "#8fafe8",
        "background": "#080c14",
        "surface": "#121a28",
        "accent": "#1e2a40",
    },
}


def _hex_to_rgb(hex_color: str) -> tuple[float, float, float]:
    value = hex_color.lstrip("#")
    r = int(value[0:2], 16) / 255
    g = int(value[2:4], 16) / 255
    b = int(value[4:6], 16) / 255
    return r, g, b


def _linearize(channel: float) -> float:
    if channel <= 0.03928:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def _relative_luminance(hex_color: str) -> float:
    r, g, b = _hex_to_rgb(hex_color)
    return 0.2126 * _linearize(r) + 0.7152 * _linearize(g) + 0.0722 * _linearize(b)


def _contrast_ratio(foreground: str, background: str) -> float:
    l1 = _relative_luminance(foreground)
    l2 = _relative_luminance(background)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def _pick_foreground(background: str) -> str:
    candidates = ("#ffffff", "#f8fafc", "#e8ecf2", "#1a1a1a", "#0c1018", "#000000")
    best = "#ffffff"
    best_ratio = 0.0
    for candidate in candidates:
        ratio = _contrast_ratio(candidate, background)
        if ratio > best_ratio:
            best_ratio = ratio
            best = candidate
    return best


def _slot_map_for_mode(preset_id: str, mode: str) -> dict[str, str]:
    source = PRESET_LIGHT if mode == "light" else PRESET_DARK
    return dict(source[preset_id])


def _merged_slots(
    preset_id: str,
    mode: str,
    overrides: ThemePaletteSlotOverrides | None,
) -> dict[str, str]:
    slots = _slot_map_for_mode(preset_id, mode)
    if overrides is None:
        return slots
    for key, value in overrides.model_dump(exclude_none=True).items():
        if value is not None:
            slots[key] = value
    return slots


def _validate_mode_slots(slots: dict[str, str], mode: str) -> list[str]:
    errors: list[str] = []
    pairs = [
        ("primary", _pick_foreground(slots["primary"]), slots["primary"], False),
        ("background", _pick_foreground(slots["background"]), slots["background"], False),
        ("surface", _pick_foreground(slots["surface"]), slots["surface"], False),
        ("secondary", _pick_foreground(slots["secondary"]), slots["secondary"], False),
        ("accent", _pick_foreground(slots["accent"]), slots["accent"], False),
        (
            "primary på overflade",
            slots["primary"],
            slots["surface"],
            True,
        ),
    ]
    min_ratio = 4.5
    for label, foreground, background, large in pairs:
        ratio = _contrast_ratio(foreground, background)
        threshold = 3.0 if large else min_ratio
        if ratio < threshold:
            errors.append(
                f"{label} ({mode}): kontrast {ratio:.1f}:1 — minimum {threshold}:1"
            )
    return errors


def normalize_theme_palette_preference(
    raw: dict | ThemePalettePreference | None,
) -> ThemePalettePreference | None:
    if raw is None:
        return None
    if isinstance(raw, ThemePalettePreference):
        return raw
    return ThemePalettePreference.model_validate(raw)


def merge_theme_palette_update(
    current: ThemePalettePreference | None,
    payload: ThemePaletteUpdateRequest,
) -> ThemePalettePreference:
    base = current or ThemePalettePreference()
    preset_id = payload.preset_id or base.preset_id
    overrides = payload.overrides if payload.overrides is not None else base.overrides
    return ThemePalettePreference(preset_id=preset_id, overrides=overrides)


def validate_theme_palette(preference: ThemePalettePreference) -> None:
    if preference.preset_id not in VALID_PRESET_IDS:
        raise ValueError("Ukendt farvetema")

    errors: list[str] = []
    for mode in ("light", "dark"):
        mode_overrides = preference.overrides.get(mode) if preference.overrides else None
        slots = _merged_slots(preference.preset_id, mode, mode_overrides)
        errors.extend(_validate_mode_slots(slots, mode))

    if errors:
        raise ValueError("; ".join(errors[:6]))


def theme_palette_to_storage(preference: ThemePalettePreference | None) -> dict | None:
    if preference is None:
        return None
    return preference.model_dump(mode="json", exclude_none=True)
