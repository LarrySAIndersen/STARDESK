import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  meetsWcagAa,
  pickForeground,
  validateThemeSlotContrast,
} from "@/lib/theme-contrast";
import { resolveThemeSlots } from "@/lib/theme-palettes";

describe("theme-contrast", () => {
  it("picks readable foreground for navy background", () => {
    expect(pickForeground("#1b3a6b")).toBe("#ffffff");
    expect(meetsWcagAa("#ffffff", "#1b3a6b")).toBe(true);
  });

  it("flags low-contrast slot combinations", () => {
    const issues = validateThemeSlotContrast({
      primary: "#f5f5f5",
      secondary: "#3b5a95",
      background: "#ffffff",
      surface: "#ffffff",
      accent: "#e8eef7",
    });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.ratio).toBeLessThan(4.5);
  });

  it("accepts STAR standard day palette slots", () => {
    const slots = resolveThemeSlots({ preset_id: "star-standard" }, "light");
    const issues = validateThemeSlotContrast(slots);
    expect(issues).toHaveLength(0);
    expect(contrastRatio(pickForeground(slots.primary), slots.primary)).toBeGreaterThanOrEqual(4.5);
  });
});
