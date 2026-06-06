/** STARdesk palette for personal post-it notes (huskeliste). */

export type PersonalNoteColorId = "navy" | "blue" | "red" | "teal";

export const PERSONAL_NOTE_COLORS: ReadonlyArray<{
  id: PersonalNoteColorId;
  label: string;
  /** Card surface + border */
  className: string;
  /** Color picker swatch */
  swatchClassName: string;
}> = [
  {
    id: "navy",
    label: "Navy",
    className: "bg-star-blue-light border-star-navy/35 text-star-navy",
    swatchClassName: "bg-star-navy",
  },
  {
    id: "blue",
    label: "Blå",
    className: "bg-star-blue-light border-star-blue/45 text-star-navy",
    swatchClassName: "bg-star-blue",
  },
  {
    id: "red",
    label: "Rød",
    className: "bg-star-red-light border-star-red/35 text-star-navy",
    swatchClassName: "bg-star-red",
  },
  {
    id: "teal",
    label: "Turkis",
    className:
      "border-[color-mix(in_srgb,var(--asset-cat-integration)_35%,transparent)] bg-[var(--asset-cat-integration-muted)] text-star-navy",
    swatchClassName: "bg-[var(--asset-cat-integration)]",
  },
] as const;

/** Legacy color ids stored before STAR palette migration. */
const LEGACY_COLOR_MAP: Record<string, PersonalNoteColorId> = {
  yellow: "navy",
  blue: "blue",
  green: "teal",
  pink: "red",
};

export function resolveNoteColorId(color: string | null | undefined): PersonalNoteColorId | null {
  if (!color) return null;
  if (LEGACY_COLOR_MAP[color]) return LEGACY_COLOR_MAP[color];
  if (PERSONAL_NOTE_COLORS.some((c) => c.id === color)) return color as PersonalNoteColorId;
  return null;
}

export function personalNoteColorClass(color: string | null | undefined): string {
  const id = resolveNoteColorId(color);
  return (
    PERSONAL_NOTE_COLORS.find((c) => c.id === id)?.className ??
    "bg-star-blue-light border-star-navy/25 text-star-navy"
  );
}
