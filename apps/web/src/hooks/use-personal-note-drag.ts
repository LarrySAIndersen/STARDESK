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
  boardX?: number;
  boardY?: number;
};

const BOARD_NOTE_WIDTH = 176;
const BOARD_NOTE_HEIGHT = 120;

function readBoardPosition(
  target: HTMLElement,
  clientX: number,
  clientY: number,
): { boardX: number; boardY: number } {
  const viewport = target.closest("[data-cork-viewport]") as HTMLElement | null;
  const host = viewport ?? target;
  const rect = host.getBoundingClientRect();
  const zoom = viewport ? parseFloat(viewport.dataset.boardZoom ?? "1") : 1;
  const panX = viewport ? parseFloat(viewport.dataset.boardPanX ?? "0") : 0;
  const panY = viewport ? parseFloat(viewport.dataset.boardPanY ?? "0") : 0;

  const canvas = viewport?.querySelector(
    "[data-cork-canvas]",
  ) as HTMLElement | null;
  const canvasWidth = canvas?.offsetWidth ?? rect.width / zoom;
  const canvasHeight = canvas?.offsetHeight ?? rect.height / zoom;

  const canvasX = (clientX - rect.left - panX) / zoom;
  const canvasY = (clientY - rect.top - panY) / zoom;

  const maxX = Math.max(0, canvasWidth - BOARD_NOTE_WIDTH);
  const maxY = Math.max(0, canvasHeight - BOARD_NOTE_HEIGHT);
  const boardX = Math.min(maxX, Math.max(0, canvasX - BOARD_NOTE_WIDTH / 2));
  const boardY = Math.min(maxY, Math.max(0, canvasY - 24));
  return { boardX, boardY };
}

export function resolvePersonalNoteDropTarget(
  elements: Element[],
  clientX?: number,
  clientY?: number,
): PersonalNoteDropTarget | null {
  for (const el of elements) {
    const target = el.closest("[data-note-drop]") as HTMLElement | null;
    if (!target) continue;
    const zone = target.dataset.noteDrop as PersonalNoteDropZone | undefined;
    if (!zone) continue;
    const result: PersonalNoteDropTarget = {
      zone,
      ticketId: target.dataset.ticketId,
      ticketNumber: target.dataset.ticketNumber,
      ticketTitle: target.dataset.ticketTitle,
    };
    if (zone === "board" && clientX !== undefined && clientY !== undefined) {
      const position = readBoardPosition(target, clientX, clientY);
      result.boardX = position.boardX;
      result.boardY = position.boardY;
    }
    return result;
  }
  return null;
}

function readDropTarget(clientX: number, clientY: number): PersonalNoteDropTarget | null {
  const elements = document.elementsFromPoint(clientX, clientY);
  return resolvePersonalNoteDropTarget(elements, clientX, clientY);
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

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
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
    isZoneActive,
    isDragging: drag !== null,
  };
}
