"use client";

import { Palette } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { applyThemePalette } from "@/lib/theme-palette-apply";
import { validateThemeSlotContrast } from "@/lib/theme-contrast";
import {
  DEFAULT_THEME_PALETTE,
  getThemePreset,
  normalizeThemePalettePreference,
  THEME_PALETTE_PRESETS,
  THEME_SLOT_LABELS,
  type ThemeMode,
  type ThemePalettePreference,
  type ThemePalettePresetId,
  type ThemeSlotId,
} from "@/lib/theme-palettes";
import { saveUserThemePalette } from "@/lib/user-theme-palette";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

const SLOT_ORDER: ThemeSlotId[] = ["primary", "secondary", "background", "surface", "accent"];

const SWATCH_OPTIONS = [
  "#1b3a6b",
  "#3b5a95",
  "#0d5c7a",
  "#1a5c3a",
  "#334155",
  "#5a3d7a",
  "#9a4d2e",
  "#0b1f44",
  "#f2f2ef",
  "#ffffff",
  "#e8eef7",
  "#dbeafe",
  "#dceee3",
  "#161d28",
  "#0c1018",
  "#243248",
] as const;

function buildPreference(
  presetId: ThemePalettePresetId,
  overrides: ThemePalettePreference["overrides"],
): ThemePalettePreference {
  return {
    preset_id: presetId,
    overrides: overrides && Object.keys(overrides).length > 0 ? overrides : undefined,
  };
}

function PaletteSwatchCircle({
  colors,
  className,
}: Readonly<{ colors: string[]; className?: string }>) {
  const gradient = `conic-gradient(${colors.map((color, index) => {
    const start = (index / colors.length) * 100;
    const end = ((index + 1) / colors.length) * 100;
    return `${color} ${start}% ${end}%`;
  }).join(", ")})`;

  return (
    <span
      className={cn("inline-block rounded-full border border-white/40 shadow-sm", className)}
      style={{ background: gradient }}
      aria-hidden
    />
  );
}

export function ThemePalettePicker({
  user,
  variant = "default",
  onUserUpdated,
}: Readonly<{
  user: User;
  variant?: "default" | "chrome";
  onUserUpdated?: (user: User) => void;
}>) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const mode: ThemeMode = resolvedTheme === "dark" ? "dark" : "light";

  const initial = useMemo(
    () => normalizeThemePalettePreference(user.theme_palette) ?? DEFAULT_THEME_PALETTE,
    [user.theme_palette],
  );

  const [open, setOpen] = useState(false);
  const [presetId, setPresetId] = useState<ThemePalettePresetId>(initial.preset_id);
  const [overrides, setOverrides] = useState<ThemePalettePreference["overrides"]>(
    initial.overrides ?? {},
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const draft = useMemo(() => buildPreference(presetId, overrides), [presetId, overrides]);

  const previewSlots = useMemo(() => {
    const preset = getThemePreset(presetId);
    const base = mode === "light" ? preset.light : preset.dark;
    const modeOverrides = overrides?.[mode] ?? {};
    return SLOT_ORDER.map((slot) => modeOverrides[slot] ?? base[slot]);
  }, [mode, overrides, presetId]);

  useEffect(() => {
    if (!open) {
      applyThemePalette(initial, mode);
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [initial, mode, open]);

  useEffect(() => {
    if (!open) return;
    applyThemePalette(draft, mode);
  }, [draft, mode, open]);

  const validateDraft = useCallback(() => {
    const preset = getThemePreset(presetId);
    const base = mode === "light" ? preset.light : preset.dark;
    const modeOverrides = overrides?.[mode] ?? {};
    const slots = {
      primary: modeOverrides.primary ?? base.primary,
      secondary: modeOverrides.secondary ?? base.secondary,
      background: modeOverrides.background ?? base.background,
      surface: modeOverrides.surface ?? base.surface,
      accent: modeOverrides.accent ?? base.accent,
    };
    const issues = validateThemeSlotContrast(slots);
    if (issues.length > 0) {
      const first = issues[0];
      setError(
        `${first.label}: kontrast ${first.ratio.toFixed(1)}:1 — minimum ${first.required}:1`,
      );
      return false;
    }
    setError(null);
    return true;
  }, [mode, overrides, presetId]);

  const handlePresetSelect = (nextPresetId: ThemePalettePresetId) => {
    setPresetId(nextPresetId);
    setError(null);
  };

  const handleSlotColor = (slot: ThemeSlotId, color: string) => {
    setOverrides((current) => ({
      ...current,
      [mode]: {
        ...(current?.[mode] ?? {}),
        [slot]: color,
      },
    }));
    setError(null);
  };

  const handleReset = () => {
    setPresetId("star-standard");
    setOverrides({});
    setError(null);
  };

  const handleSave = async () => {
    if (!validateDraft()) return;
    setSaving(true);
    const result = await saveUserThemePalette(draft);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onUserUpdated?.(result.user);
    setOpen(false);
  };

  const chrome = variant === "chrome";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-semibold transition-colors",
          chrome
            ? "border-white/25 bg-white/10 text-white hover:bg-white/20"
            : "border-border bg-muted/30 text-foreground hover:bg-accent",
        )}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Palette className="size-3.5" aria-hidden />
        <PaletteSwatchCircle colors={previewSlots} className="size-5" />
        <span className="sr-only sm:not-sr-only">Farver</span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Vælg farvetema"
          className={cn(
            "absolute top-full right-0 z-[70] mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-md border p-3 shadow-lg",
            chrome
              ? "border-white/20 bg-[var(--star-chrome-elevated)] text-white"
              : "border-border bg-popover text-popover-foreground",
          )}
        >
          <p className="mb-2 text-sm font-semibold">Farvetema</p>
          <p className="mb-3 text-xs opacity-80">
            Branding (topbjælke og Help-a-Bot) er låst. Tilpas indhold under bjælken.
          </p>

          <div className="space-y-2">
            {THEME_PALETTE_PRESETS.map((preset) => {
              const colors =
                mode === "light"
                  ? SLOT_ORDER.map((slot) => preset.light[slot])
                  : SLOT_ORDER.map((slot) => preset.dark[slot]);
              const selected = presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border px-2 py-2 text-left text-sm transition-colors",
                    selected
                      ? chrome
                        ? "border-white/50 bg-white/15"
                        : "border-primary bg-accent"
                      : chrome
                        ? "border-white/15 hover:bg-white/10"
                        : "border-border hover:bg-muted/50",
                  )}
                  onClick={() => handlePresetSelect(preset.id)}
                  aria-pressed={selected}
                >
                  <PaletteSwatchCircle colors={colors} className="size-7 shrink-0" />
                  <span className="font-medium">{preset.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 border-t border-current/15 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-80">
              Tilpas ({mode === "light" ? "dag" : "nat"})
            </p>
            <div className="space-y-2">
              {SLOT_ORDER.map((slot) => {
                const preset = getThemePreset(presetId);
                const current =
                  overrides?.[mode]?.[slot] ??
                  (mode === "light" ? preset.light[slot] : preset.dark[slot]);
                return (
                  <div key={slot} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{THEME_SLOT_LABELS[slot]}</span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {SWATCH_OPTIONS.map((color) => (
                        <button
                          key={`${slot}-${color}`}
                          type="button"
                          className={cn(
                            "size-5 rounded-full border",
                            current === color ? "ring-2 ring-white/80 ring-offset-1" : "border-white/20",
                          )}
                          style={{ backgroundColor: color }}
                          aria-label={`${THEME_SLOT_LABELS[slot]} ${color}`}
                          aria-pressed={current === color}
                          onClick={() => handleSlotColor(slot, color)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error ? (
            <p className="mt-3 text-xs font-medium text-[#ffb4b4]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className={cn(
                "rounded-sm px-2 py-1 text-xs font-semibold",
                chrome ? "hover:bg-white/10" : "hover:bg-muted",
              )}
              onClick={handleReset}
            >
              Nulstil
            </button>
            <button
              type="button"
              className={cn(
                "rounded-sm px-3 py-1 text-xs font-semibold",
                chrome
                  ? "bg-white text-[var(--star-chrome)] hover:bg-white/90"
                  : "bg-primary text-primary-foreground hover:opacity-90",
              )}
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Gemmer…" : "Gem"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
