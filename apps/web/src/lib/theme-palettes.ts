/** User-customizable theme slots (branding chrome + Help-a-Bot stay locked). */

export type ThemeMode = "light" | "dark";

export type ThemeSlotId = "primary" | "secondary" | "background" | "surface" | "accent";

export type ThemeSlotColors = Record<ThemeSlotId, string>;

export type ThemePalettePresetId =
  | "star-standard"
  | "ocean"
  | "forest"
  | "slate"
  | "plum"
  | "sunset"
  | "high-contrast"
  | "midnight";

export type ThemePaletteOverrides = Partial<Record<ThemeMode, Partial<ThemeSlotColors>>>;

export interface ThemePalettePreference {
  preset_id: ThemePalettePresetId;
  overrides?: ThemePaletteOverrides;
}

export const DEFAULT_THEME_PALETTE: ThemePalettePreference = {
  preset_id: "star-standard",
};

export const THEME_SLOT_LABELS: Record<ThemeSlotId, string> = {
  primary: "Primær",
  secondary: "Sekundær",
  background: "Baggrund",
  surface: "Overflade",
  accent: "Accent",
};

export const THEME_PALETTE_PRESETS: ReadonlyArray<{
  id: ThemePalettePresetId;
  label: string;
  light: ThemeSlotColors;
  dark: ThemeSlotColors;
}> = [
  {
    id: "star-standard",
    label: "STAR Standard",
    light: {
      primary: "#1b3a6b",
      secondary: "#3b5a95",
      background: "#f2f2ef",
      surface: "#ffffff",
      accent: "#e8eef7",
    },
    dark: {
      primary: "#5b82c4",
      secondary: "#7ba3d4",
      background: "#0c1018",
      surface: "#161d28",
      accent: "#243248",
    },
  },
  {
    id: "ocean",
    label: "Ocean",
    light: {
      primary: "#0d5c7a",
      secondary: "#2a8fad",
      background: "#eef6f8",
      surface: "#ffffff",
      accent: "#d9eef5",
    },
    dark: {
      primary: "#4db8d9",
      secondary: "#6ecae6",
      background: "#081318",
      surface: "#101d24",
      accent: "#1a3340",
    },
  },
  {
    id: "forest",
    label: "Skov",
    light: {
      primary: "#1a5c3a",
      secondary: "#2f8f5c",
      background: "#eef5f0",
      surface: "#ffffff",
      accent: "#dceee3",
    },
    dark: {
      primary: "#4db87a",
      secondary: "#6fd69a",
      background: "#081410",
      surface: "#101f18",
      accent: "#1a3328",
    },
  },
  {
    id: "slate",
    label: "Skifer",
    light: {
      primary: "#334155",
      secondary: "#64748b",
      background: "#f1f5f9",
      surface: "#ffffff",
      accent: "#e2e8f0",
    },
    dark: {
      primary: "#94a3b8",
      secondary: "#cbd5e1",
      background: "#0c1018",
      surface: "#161d28",
      accent: "#243044",
    },
  },
  {
    id: "plum",
    label: "Blomme",
    light: {
      primary: "#5a3d7a",
      secondary: "#7c5aa0",
      background: "#f3eff7",
      surface: "#ffffff",
      accent: "#ebe3f3",
    },
    dark: {
      primary: "#b794e8",
      secondary: "#d4b8f5",
      background: "#100c18",
      surface: "#1a1428",
      accent: "#2d2440",
    },
  },
  {
    id: "sunset",
    label: "Solnedgang",
    light: {
      primary: "#9a4d2e",
      secondary: "#c4724a",
      background: "#faf3ee",
      surface: "#ffffff",
      accent: "#f5e4d9",
    },
    dark: {
      primary: "#e8a07a",
      secondary: "#f0b89a",
      background: "#140e0a",
      surface: "#221812",
      accent: "#3d2a20",
    },
  },
  {
    id: "high-contrast",
    label: "Høj kontrast",
    light: {
      primary: "#0b1f44",
      secondary: "#1f3f7a",
      background: "#ffffff",
      surface: "#f8fafc",
      accent: "#dbeafe",
    },
    dark: {
      primary: "#8eb4ff",
      secondary: "#b8d0ff",
      background: "#000000",
      surface: "#111111",
      accent: "#1f2a44",
    },
  },
  {
    id: "midnight",
    label: "Midnat",
    light: {
      primary: "#152a52",
      secondary: "#2f4f86",
      background: "#e9edf5",
      surface: "#ffffff",
      accent: "#d5dff0",
    },
    dark: {
      primary: "#6b8fd4",
      secondary: "#8fafe8",
      background: "#080c14",
      surface: "#121a28",
      accent: "#1e2a40",
    },
  },
] as const;

export function getThemePreset(id: ThemePalettePresetId) {
  return THEME_PALETTE_PRESETS.find((preset) => preset.id === id) ?? THEME_PALETTE_PRESETS[0];
}

export function resolveThemeSlots(
  preference: ThemePalettePreference | null | undefined,
  mode: ThemeMode,
): ThemeSlotColors {
  const preset = getThemePreset(preference?.preset_id ?? "star-standard");
  const base = mode === "light" ? preset.light : preset.dark;
  const overrides = preference?.overrides?.[mode] ?? {};
  return {
    primary: overrides.primary ?? base.primary,
    secondary: overrides.secondary ?? base.secondary,
    background: overrides.background ?? base.background,
    surface: overrides.surface ?? base.surface,
    accent: overrides.accent ?? base.accent,
  };
}

export function isDefaultThemePalette(preference: ThemePalettePreference | null | undefined): boolean {
  if (!preference) return true;
  if (preference.preset_id !== "star-standard") return false;
  const overrides = preference.overrides;
  if (!overrides) return true;
  return Object.keys(overrides).length === 0;
}

export function normalizeThemePalettePreference(
  raw: unknown,
): ThemePalettePreference | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<ThemePalettePreference>;
  const presetId = value.preset_id;
  if (!presetId || !THEME_PALETTE_PRESETS.some((preset) => preset.id === presetId)) {
    return null;
  }
  return {
    preset_id: presetId,
    overrides: value.overrides,
  };
}
