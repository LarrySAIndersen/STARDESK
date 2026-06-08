export const PERSONAL_NOTE_DRAG_MIME = "application/x-stardesk-personal-note";
export const PERSONAL_KANBAN_DRAG_MIME = "application/x-stardesk-personal-kanban";

export function readDraggedNoteId(dataTransfer: DataTransfer): string {
  return dataTransfer.getData(PERSONAL_NOTE_DRAG_MIME) || dataTransfer.getData("text/plain") || "";
}

export function readDraggedTicketId(dataTransfer: DataTransfer): string {
  return (
    dataTransfer.getData(PERSONAL_KANBAN_DRAG_MIME) || dataTransfer.getData("text/plain") || ""
  );
}

export function isNoteDrag(dataTransfer: DataTransfer): boolean {
  return (
    dataTransfer.types.includes(PERSONAL_NOTE_DRAG_MIME) ||
    dataTransfer.types.includes("text/plain")
  );
}

export function beginNoteDrag(dataTransfer: DataTransfer, noteId: string): void {
  dataTransfer.setData(PERSONAL_NOTE_DRAG_MIME, noteId);
  dataTransfer.setData("text/plain", noteId);
  dataTransfer.effectAllowed = "move";
}

export function beginTicketDrag(dataTransfer: DataTransfer, ticketId: string): void {
  dataTransfer.setData(PERSONAL_KANBAN_DRAG_MIME, ticketId);
  dataTransfer.setData("text/plain", ticketId);
  dataTransfer.effectAllowed = "move";
}

export function shouldBlockNoteDrag(target: EventTarget | null): boolean {
  return Boolean((target as HTMLElement | null)?.closest("[data-no-drag]"));
}
