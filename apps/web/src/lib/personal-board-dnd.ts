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
