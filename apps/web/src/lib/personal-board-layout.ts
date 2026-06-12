import type { PersonalNote } from "@/types/personal";

export const BOARD_FALLBACK_POSITIONS = [
  { x: 24, y: 28, rotate: -2.4 },
  { x: 210, y: 48, rotate: 1.8 },
  { x: 120, y: 140, rotate: -1.1 },
  { x: 300, y: 120, rotate: 2.2 },
  { x: 48, y: 220, rotate: -0.8 },
  { x: 240, y: 240, rotate: 1.4 },
] as const;

export const STACK_OFFSETS = [
  { rotate: -3.5, x: 0, y: 0 },
  { rotate: 2.2, x: 6, y: 8 },
  { rotate: -1.8, x: 10, y: 16 },
  { rotate: 2.8, x: 4, y: 24 },
] as const;

/** Tray stack on bulletin board — slightly different scatter than cork board pile. */
export const NOTE_TRAY_STACK_OFFSETS = [
  { rotate: -4, x: 0, y: 0 },
  { rotate: 2.5, x: 5, y: 7 },
  { rotate: -1.5, x: 9, y: 14 },
  { rotate: 3, x: 3, y: 21 },
] as const;

export const CORK_MIN_ZOOM = 0.32;
export const CORK_MAX_ZOOM = 1.75;
export const CORK_DEFAULT_ZOOM = 0.32;
export const CORK_ZOOM_STEP = 0.08;

export function clampCorkZoom(value: number): number {
  return Math.min(CORK_MAX_ZOOM, Math.max(CORK_MIN_ZOOM, value));
}

export function adjustCorkZoom(current: number, direction: "in" | "out"): number {
  const delta = direction === "in" ? CORK_ZOOM_STEP : -CORK_ZOOM_STEP;
  return clampCorkZoom(current + delta);
}

export function ticketById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}

export function boardPositionForNote(note: PersonalNote, index: number) {
  if (note.board_x != null && note.board_y != null) {
    return { x: note.board_x, y: note.board_y };
  }
  const fallback = BOARD_FALLBACK_POSITIONS[index % BOARD_FALLBACK_POSITIONS.length];
  return { x: fallback.x, y: fallback.y };
}

export function boardRotationForNote(note: PersonalNote, index: number) {
  const fallback = BOARD_FALLBACK_POSITIONS[index % BOARD_FALLBACK_POSITIONS.length];
  return fallback.rotate;
}

export function stackOffsetForIndex(index: number) {
  return STACK_OFFSETS[index % STACK_OFFSETS.length];
}

export function noteTrayStackOffsetForIndex(index: number) {
  return NOTE_TRAY_STACK_OFFSETS[index % NOTE_TRAY_STACK_OFFSETS.length];
}

export function pickPersonalNoteColorId(
  colors: readonly { id: string }[],
  noteCount: number,
): string {
  if (colors.length === 0) return "yellow";
  return colors[noteCount % colors.length].id;
}

export function sortStackNotes(notes: PersonalNote[]): PersonalNote[] {
  return [...notes]
    .filter((n) => !n.is_pinned)
    .sort((a, b) => a.sort_order - b.sort_order || b.updated_at.localeCompare(a.updated_at));
}

export function sortBoardNotes(notes: PersonalNote[]): PersonalNote[] {
  return [...notes]
    .filter((n) => n.is_pinned)
    .sort((a, b) => a.sort_order - b.sort_order || b.updated_at.localeCompare(a.updated_at));
}
