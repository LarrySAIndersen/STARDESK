/** WCAG contrast helpers for theme palette validation and foreground derivation. */

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function linearize(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function pickForeground(background: string): string {
  const candidates = ["#ffffff", "#f8fafc", "#e8ecf2", "#1a1a1a", "#0c1018", "#000000"];
  let best = "#ffffff";
  let bestRatio = 0;
  for (const candidate of candidates) {
    const ratio = contrastRatio(candidate, background);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = candidate;
    }
  }
  return best;
}

export function meetsWcagAa(
  foreground: string,
  background: string,
  largeText = false,
): boolean {
  const threshold = largeText ? 3 : 4.5;
  return contrastRatio(foreground, background) >= threshold;
}

export type ThemeContrastIssue = {
  label: string;
  ratio: number;
  required: number;
};

export function validateThemeSlotContrast(slots: {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  accent: string;
}): ThemeContrastIssue[] {
  const issues: ThemeContrastIssue[] = [];
  const checks: Array<{ label: string; foreground: string; background: string; ui?: boolean }> = [
    { label: "Primær", foreground: pickForeground(slots.primary), background: slots.primary },
    { label: "Baggrund", foreground: pickForeground(slots.background), background: slots.background },
    { label: "Overflade", foreground: pickForeground(slots.surface), background: slots.surface },
    { label: "Sekundær", foreground: pickForeground(slots.secondary), background: slots.secondary },
    { label: "Accent", foreground: pickForeground(slots.accent), background: slots.accent },
    { label: "Primær på overflade", foreground: slots.primary, background: slots.surface, ui: true },
  ];

  for (const check of checks) {
    const ratio = contrastRatio(check.foreground, check.background);
    const threshold = check.ui ? 3 : 4.5;
    if (ratio < threshold) {
      issues.push({ label: check.label, ratio, required: threshold });
    }
  }

  return issues;
}

export function mixHex(base: string, target: string, amount: number): string {
  const a = hexToRgb(base);
  const b = hexToRgb(target);
  const mix = (channel: "r" | "g" | "b") =>
    Math.round(a[channel] + (b[channel] - a[channel]) * amount);
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(mix("r"))}${toHex(mix("g"))}${toHex(mix("b"))}`;
}
