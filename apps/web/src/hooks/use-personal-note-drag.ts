"use client";

import { useCallback, useEffect, useState } from "react";

export type PersonalNoteDropZone = "stack" | "board" | "ticket";

export type PersonalNoteDragState = {
  noteId: string;
  x: number;
  y: number;
};

export type PersonalNoteDropTarget = {
  zone: PersonalNoteDropZone;
  ticketId?: string;
  ticketNumber?: string;
  ticketTitle?: string;
};

function readDropTarget(clientX: number, clientY: number): PersonalNoteDropTarget | null {
  const elements = document.elementsFromPoint(clientX, clientY);
  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue;
    const target = el.closest("[data-note-drop]");
    if (!target) continue;
    const zone = (target as HTMLElement).dataset.noteDrop as PersonalNoteDropZone | undefined;
    if (!zone) continue;
    return {
      zone,
      ticketId: (target as HTMLElement).dataset.ticketId,
      ticketNumber: (target as HTMLElement).dataset.ticketNumber,
      ticketTitle: (target as HTMLElement).dataset.ticketTitle,
    };
  }
  return null;
}

export function usePersonalNoteDrag(
  onDrop: (noteId: string, target: PersonalNoteDropTarget) => void,
) {
  const [drag, setDrag] = useState<PersonalNoteDragState | null>(null);
  const [hover, setHover] = useState<PersonalNoteDropTarget | null>(null);

  const startDrag = useCallback((noteId: string, clientX: number, clientY: number) => {
    setDrag({ noteId, x: clientX, y: clientY });
    setHover(readDropTarget(clientX, clientY));
  }, []);

  const cancelDrag = useCallback(() => {
    setDrag(null);
    setHover(null);
  }, []);

  useEffect(() => {
    if (!drag) return;

    const onMove = (event: PointerEvent) => {
      setDrag((current) =>
        current ? { ...current, x: event.clientX, y: event.clientY } : null,
      );
      setHover(readDropTarget(event.clientX, event.clientY));
    };

    const onUp = (event: PointerEvent) => {
      const target = readDropTarget(event.clientX, event.clientY);
      if (target) {
        onDrop(drag.noteId, target);
      }
      setDrag(null);
      setHover(null);
    };

    const onCancel = () => {
      setDrag(null);
      setHover(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [drag, onDrop]);

  const isZoneActive = useCallback(
    (zone: PersonalNoteDropZone, ticketId?: string) => {
      if (!hover || hover.zone !== zone) return false;
      if (zone === "ticket") return hover.ticketId === ticketId;
      return true;
    },
    [hover],
  );

  return {
    drag,
    hover,
    startDrag,
    cancelDrag,
    isZoneActive,
    isDragging: drag !== null,
  };
}
