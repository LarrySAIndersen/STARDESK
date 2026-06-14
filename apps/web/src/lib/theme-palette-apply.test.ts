import { describe, expect, it } from "vitest";

import {
  applyThemePalette,
  clearAppliedThemePalette,
  validateThemePalettePreference,
} from "@/lib/theme-palette-apply";
import { DEFAULT_THEME_PALETTE } from "@/lib/theme-palettes";

describe("theme-palette-apply", () => {
  it("clears inline palette vars for default theme", () => {
    document.documentElement.style.setProperty("--primary", "#123456");
    clearAppliedThemePalette();
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("");
  });

  it("applies palette vars for non-default preset", () => {
    applyThemePalette({ preset_id: "ocean" }, "light");
    expect(document.documentElement.style.getPropertyValue("--primary")).not.toBe("");
    clearAppliedThemePalette();
  });

  it("validates ocean preset in light mode", () => {
    const issues = validateThemePalettePreference(DEFAULT_THEME_PALETTE, "light");
    expect(issues).toHaveLength(0);
  });
});
