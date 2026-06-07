export const PERSONAL_NOTE_DRAG_MIME = "application/x-stardesk-personal-note";
export const PERSONAL_KANBAN_DRAG_MIME = "application/x-stardesk-personal-kanban";

/** Tracks the note id during drag — dataTransfer.types is unreliable during dragover. */
let activeNoteDragId: string | null = null;

export function getActiveNoteDragId(): string | null {
  return activeNoteDragId;
}

export function readDraggedNoteId(dataTransfer: DataTransfer): string {
  return (
    dataTransfer.getData(PERSONAL_NOTE_DRAG_MIME) ||
    dataTransfer.getData("text/plain") ||
    activeNoteDragId ||
    ""
  );
}

export function readDraggedTicketId(dataTransfer: DataTransfer): string {
  return (
    dataTransfer.getData(PERSONAL_KANBAN_DRAG_MIME) || dataTransfer.getData("text/plain") || ""
  );
}

export function isNoteDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(PERSONAL_NOTE_DRAG_MIME);
}

export function isNoteDragActive(dataTransfer?: DataTransfer | null): boolean {
  if (activeNoteDragId) return true;
  if (!dataTransfer) return false;
  return isNoteDrag(dataTransfer);
}

export function beginNoteDrag(dataTransfer: DataTransfer, noteId: string): void {
  activeNoteDragId = noteId;
  dataTransfer.setData(PERSONAL_NOTE_DRAG_MIME, noteId);
  dataTransfer.setData("text/plain", noteId);
  dataTransfer.effectAllowed = "move";
}

export function endNoteDrag(): void {
  activeNoteDragId = null;
}

export function shouldBlockNoteDrag(target: EventTarget | null): boolean {
  return Boolean((target as HTMLElement | null)?.closest("[data-no-drag]"));
}
