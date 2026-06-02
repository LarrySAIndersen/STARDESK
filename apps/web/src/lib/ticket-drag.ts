/** Shared drag-and-drop payload for ticket rows (dispatch + service desk). */
export const TICKET_DRAG_TYPE = "application/x-stardesk-ticket";

export function readDraggedTicketId(dataTransfer: DataTransfer): string {
  const fromCustom = dataTransfer.getData(TICKET_DRAG_TYPE);
  if (fromCustom) {
    return fromCustom;
  }
  const plain = dataTransfer.getData("text/plain");
  if (plain && /^[0-9a-f-]{36}$/i.test(plain)) {
    return plain;
  }
  return "";
}

export function setTicketDragData(event: React.DragEvent, ticketId: string) {
  event.dataTransfer.setData(TICKET_DRAG_TYPE, ticketId);
  event.dataTransfer.setData("text/plain", ticketId);
  event.dataTransfer.effectAllowed = "move";
  // Hide native drag image — dashboard uses a custom AI ghost overlay.
  if (typeof document !== "undefined") {
    const blank = document.createElement("span");
    blank.style.position = "fixed";
    blank.style.top = "-9999px";
    document.body.appendChild(blank);
    event.dataTransfer.setDragImage(blank, 0, 0);
    window.requestAnimationFrame(() => blank.remove());
  }
}
