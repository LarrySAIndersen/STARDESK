import {
  mixHex,
  pickForeground,
  type ThemeContrastIssue,
  validateThemeSlotContrast,
} from "@/lib/theme-contrast";
import {
  DEFAULT_THEME_PALETTE,
  isDefaultThemePalette,
  resolveThemeSlots,
  type ThemeMode,
  type ThemePalettePreference,
} from "@/lib/theme-palettes";

const PALETTE_CSS_VARS = [
  "--star-primary",
  "--primary",
  "--primary-foreground",
  "--star-navy",
  "--background",
  "--star-gray-bar",
  "--foreground",
  "--star-text",
  "--card",
  "--star-surface",
  "--card-foreground",
  "--star-blue",
  "--secondary",
  "--secondary-foreground",
  "--star-blue-light",
  "--accent",
  "--accent-foreground",
  "--muted",
  "--muted-foreground",
  "--border",
  "--input",
  "--ring",
  "--popover",
  "--popover-foreground",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--page-layout-highlight",
] as const;

export function validateThemePalettePreference(
  preference: ThemePalettePreference,
  mode: ThemeMode,
): ThemeContrastIssue[] {
  const slots = resolveThemeSlots(preference, mode);
  return validateThemeSlotContrast(slots);
}

export function clearAppliedThemePalette(): void {
  if (typeof document === "undefined") return;
  for (const cssVar of PALETTE_CSS_VARS) {
    document.documentElement.style.removeProperty(cssVar);
  }
}

export function applyThemePalette(
  preference: ThemePalettePreference | null | undefined,
  mode: ThemeMode,
): void {
  if (typeof document === "undefined") return;
  if (isDefaultThemePalette(preference)) {
    clearAppliedThemePalette();
    return;
  }

  const resolved = preference ?? DEFAULT_THEME_PALETTE;
  const slots = resolveThemeSlots(resolved, mode);
  const primaryFg = pickForeground(slots.primary);
  const surfaceFg = pickForeground(slots.surface);
  const backgroundFg = pickForeground(slots.background);
  const secondaryFg = pickForeground(slots.secondary);
  const accentFg = pickForeground(slots.accent);
  const muted = mixHex(slots.background, slots.surface, mode === "light" ? 0.08 : 0.22);
  const mutedFg = mixHex(backgroundFg, slots.secondary, 0.45);
  const border = mixHex(slots.background, slots.primary, mode === "light" ? 0.18 : 0.35);

  const assignments: Record<string, string> = {
    "--star-primary": slots.primary,
    "--primary": slots.primary,
    "--primary-foreground": primaryFg,
    "--star-navy": slots.primary,
    "--background": slots.background,
    "--star-gray-bar": slots.background,
    "--foreground": backgroundFg,
    "--star-text": backgroundFg,
    "--card": slots.surface,
    "--star-surface": slots.surface,
    "--card-foreground": surfaceFg,
    "--star-blue": slots.secondary,
    "--secondary": mixHex(slots.secondary, slots.accent, 0.35),
    "--secondary-foreground": secondaryFg,
    "--star-blue-light": slots.accent,
    "--accent": slots.accent,
    "--accent-foreground": accentFg,
    "--muted": muted,
    "--muted-foreground": mutedFg,
    "--border": border,
    "--input": border,
    "--ring": slots.primary,
    "--popover": slots.surface,
    "--popover-foreground": surfaceFg,
    "--sidebar": mixHex(slots.surface, slots.background, 0.15),
    "--sidebar-foreground": mixHex(surfaceFg, backgroundFg, 0.35),
    "--sidebar-primary": slots.primary,
    "--sidebar-primary-foreground": primaryFg,
    "--sidebar-accent": slots.accent,
    "--sidebar-accent-foreground": accentFg,
    "--sidebar-border": border,
    "--sidebar-ring": slots.primary,
    "--page-layout-highlight": slots.primary,
  };

  for (const [cssVar, value] of Object.entries(assignments)) {
    document.documentElement.style.setProperty(cssVar, value);
  }
}
