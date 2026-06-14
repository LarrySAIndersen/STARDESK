import { describe, expect, it } from "vitest";

import { validateThemePalettePreference } from "@/lib/theme-palette-apply";
import { DEFAULT_THEME_PALETTE } from "@/lib/theme-palettes";

describe("theme-palette-apply", () => {
  it("validates star standard preset in light mode", () => {
    const issues = validateThemePalettePreference(DEFAULT_THEME_PALETTE, "light");
    expect(issues).toHaveLength(0);
  });

  it("validates ocean preset in dark mode", () => {
    const issues = validateThemePalettePreference({ preset_id: "ocean" }, "dark");
    expect(issues).toHaveLength(0);
  });
});
