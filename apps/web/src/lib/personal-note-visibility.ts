import type { PersonalNoteUpdate, PersonalNoteVisibility } from "@/types/personal";

export function personalNoteVisibilityLabel(
  visibility: PersonalNoteVisibility | string | null | undefined,
): string {
  return visibility === "team" ? "Alle på sagen" : "Kun mig";
}

export function buildPostItAttachUpdate(
  ticketId: string,
  visibility: PersonalNoteVisibility,
): PersonalNoteUpdate {
  return {
    ticket_id: ticketId,
    visibility,
  };
}

export function trimmedNoteField(
  value: string,
  previous: string,
  minLength = 1,
): string | null {
  const trimmed = value.trim();
  if (trimmed === previous) {
    return null;
  }
  if (trimmed.length < minLength) {
    return null;
  }
  return trimmed;
}
