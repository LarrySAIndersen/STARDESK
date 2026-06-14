import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME_PALETTE,
  getThemePreset,
  isDefaultThemePalette,
  normalizeThemePalettePreference,
  resolveThemeSlots,
  THEME_PALETTE_PRESETS,
} from "@/lib/theme-palettes";

describe("theme-palettes", () => {
  it("resolves slots from preset and overrides", () => {
    const slots = resolveThemeSlots(
      {
        preset_id: "ocean",
        overrides: { light: { primary: "#123456" } },
      },
      "light",
    );
    expect(slots.primary).toBe("#123456");
    expect(slots.secondary).toBe(getThemePreset("ocean").light.secondary);
  });

  it("detects default palette", () => {
    expect(isDefaultThemePalette(null)).toBe(true);
    expect(isDefaultThemePalette(DEFAULT_THEME_PALETTE)).toBe(true);
    expect(isDefaultThemePalette({ preset_id: "forest" })).toBe(false);
  });

  it("normalizes valid preference payloads", () => {
    expect(normalizeThemePalettePreference({ preset_id: "slate" })?.preset_id).toBe("slate");
    expect(normalizeThemePalettePreference({ preset_id: "nope" })).toBeNull();
  });

  it("exposes eight presets", () => {
    expect(THEME_PALETTE_PRESETS).toHaveLength(8);
  });
});
