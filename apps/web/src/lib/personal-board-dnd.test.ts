import { describe, expect, it, afterEach } from "vitest";

import {
  PERSONAL_NOTE_DRAG_MIME,
  beginNoteDrag,
  endNoteDrag,
  getActiveNoteDragId,
  isNoteDrag,
  isNoteDragActive,
  readDraggedNoteId,
  readDraggedTicketId,
  shouldBlockNoteDrag,
} from "./personal-board-dnd";

function mockDataTransfer(data: Record<string, string>, types?: string[]): DataTransfer {
  const keys = types ?? Object.keys(data);
  return {
    types: keys,
    getData(type: string) {
      return data[type] ?? "";
    },
    setData() {},
    effectAllowed: "move",
  } as DataTransfer;
}

afterEach(() => {
  endNoteDrag();
});

describe("personal-board-dnd", () => {
  it("reads note id from custom mime type", () => {
    const transfer = mockDataTransfer({
      [PERSONAL_NOTE_DRAG_MIME]: "note-123",
    });
    expect(readDraggedNoteId(transfer)).toBe("note-123");
  });

  it("falls back to plain text for note id", () => {
    const transfer = mockDataTransfer({ "text/plain": "note-456" });
    expect(readDraggedNoteId(transfer)).toBe("note-456");
  });

  it("falls back to active drag id when dataTransfer is empty on drop", () => {
    beginNoteDrag(mockDataTransfer({}), "note-active");
    const transfer = mockDataTransfer({});
    expect(readDraggedNoteId(transfer)).toBe("note-active");
  });

  it("detects note drag from mime type", () => {
    expect(isNoteDrag(mockDataTransfer({}, [PERSONAL_NOTE_DRAG_MIME]))).toBe(true);
    expect(isNoteDrag(mockDataTransfer({}, ["text/plain"]))).toBe(false);
    expect(isNoteDrag(mockDataTransfer({}, ["Files"]))).toBe(false);
  });

  it("detects active note drag during dragover", () => {
    beginNoteDrag(mockDataTransfer({}), "note-789");
    expect(isNoteDragActive()).toBe(true);
    expect(isNoteDragActive(mockDataTransfer({}, []))).toBe(true);
    endNoteDrag();
    expect(isNoteDragActive()).toBe(false);
  });

  it("sets drag data with plain-text fallback", () => {
    const stored: Record<string, string> = {};
    const transfer = {
      setData(type: string, value: string) {
        stored[type] = value;
      },
      effectAllowed: "none",
    } as DataTransfer;

    beginNoteDrag(transfer, "note-789");

    expect(stored[PERSONAL_NOTE_DRAG_MIME]).toBe("note-789");
    expect(stored["text/plain"]).toBe("note-789");
    expect(transfer.effectAllowed).toBe("move");
    expect(getActiveNoteDragId()).toBe("note-789");
  });

  it("clears active drag id on endNoteDrag", () => {
    beginNoteDrag(mockDataTransfer({}), "note-789");
    endNoteDrag();
    expect(getActiveNoteDragId()).toBeNull();
  });

  it("blocks drag when target is inside no-drag region", () => {
    const inner = {
      closest: (selector: string) => (selector === "[data-no-drag]" ? inner : null),
    } as unknown as HTMLElement;
    const outer = {
      closest: () => null,
    } as unknown as HTMLElement;
    expect(shouldBlockNoteDrag(inner)).toBe(true);
    expect(shouldBlockNoteDrag(outer)).toBe(false);
  });

  it("reads ticket id from kanban mime type", () => {
    const transfer = mockDataTransfer({
      "application/x-stardesk-personal-kanban": "ticket-789",
    });
    expect(readDraggedTicketId(transfer)).toBe("ticket-789");
  });
});
