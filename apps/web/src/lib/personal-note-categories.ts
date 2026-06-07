/** Personal post-it categories (Danish labels in UI). */

export type PersonalNoteCategoryId =
  | "general"
  | "follow_up"
  | "meeting"
  | "supplier"
  | "reminder";

export const PERSONAL_NOTE_CATEGORIES: ReadonlyArray<{
  id: PersonalNoteCategoryId;
  label: string;
  shortLabel: string;
}> = [
  { id: "general", label: "Generelt", shortLabel: "Gen." },
  { id: "follow_up", label: "Opfølgning", shortLabel: "Opf." },
  { id: "meeting", label: "Møde", shortLabel: "Møde" },
  { id: "supplier", label: "Leverandør", shortLabel: "Lev." },
  { id: "reminder", label: "Påmindelse", shortLabel: "Påm." },
] as const;

export function personalNoteCategoryLabel(
  category: string | null | undefined,
): string | null {
  if (!category) return null;
  return PERSONAL_NOTE_CATEGORIES.find((c) => c.id === category)?.label ?? null;
}

export function isPersonalNoteCategoryId(value: string): value is PersonalNoteCategoryId {
  return PERSONAL_NOTE_CATEGORIES.some((c) => c.id === value);
}
