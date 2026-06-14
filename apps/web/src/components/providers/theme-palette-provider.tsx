"use client";

import { useTheme } from "next-themes";
import { useEffect, useMemo } from "react";

import { applyThemePalette } from "@/lib/theme-palette-apply";
import {
  DEFAULT_THEME_PALETTE,
  normalizeThemePalettePreference,
  type ThemePalettePreference,
} from "@/lib/theme-palettes";

export function ThemePaletteProvider({
  preference,
  enabled = true,
}: Readonly<{
  preference?: ThemePalettePreference | null;
  enabled?: boolean;
}>) {
  const { resolvedTheme } = useTheme();
  const normalized = useMemo(
    () => normalizeThemePalettePreference(preference) ?? DEFAULT_THEME_PALETTE,
    [preference],
  );
  const mode = resolvedTheme === "dark" ? "dark" : "light";

  useEffect(() => {
    if (!enabled) {
      applyThemePalette(null, mode);
      return;
    }
    applyThemePalette(normalized, mode);
    return () => {
      applyThemePalette(null, mode);
    };
  }, [enabled, mode, normalized]);

  return null;
}
