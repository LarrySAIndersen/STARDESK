import { describe, expect, it, vi } from "vitest";

import { TICKET_DRAG_TYPE, readDraggedTicketId, setTicketDragData } from "./ticket-drag";

const TICKET_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeDataTransfer(data: Record<string, string> = {}): DataTransfer {
  return {
    getData: (type: string) => data[type] ?? "",
    setData: vi.fn((type: string, value: string) => {
      data[type] = value;
    }),
    effectAllowed: "none",
    setDragImage: vi.fn(),
  } as unknown as DataTransfer;
}

describe("readDraggedTicketId", () => {
  it("prefers custom mime type", () => {
    const dt = makeDataTransfer({
      [TICKET_DRAG_TYPE]: TICKET_ID,
      "text/plain": "other",
    });
    expect(readDraggedTicketId(dt)).toBe(TICKET_ID);
  });

  it("falls back to uuid plain text", () => {
    const dt = makeDataTransfer({ "text/plain": TICKET_ID });
    expect(readDraggedTicketId(dt)).toBe(TICKET_ID);
  });

  it("returns empty when no valid payload", () => {
    expect(readDraggedTicketId(makeDataTransfer({ "text/plain": "not-a-uuid" }))).toBe("");
  });
});

describe("setTicketDragData", () => {
  it("sets drag payload and move effect", () => {
    const data: Record<string, string> = {};
    const dataTransfer = makeDataTransfer(data);
    const event = { dataTransfer } as React.DragEvent;

    vi.stubGlobal("document", {
      createElement: () => {
        const el = { style: {} as CSSStyleDeclaration, remove: vi.fn() };
        return el;
      },
      body: { appendChild: vi.fn() },
    });
    vi.stubGlobal("window", { requestAnimationFrame: (cb: FrameRequestCallback) => cb(0) });

    setTicketDragData(event, TICKET_ID);

    expect(data[TICKET_DRAG_TYPE]).toBe(TICKET_ID);
    expect(data["text/plain"]).toBe(TICKET_ID);
    expect(dataTransfer.effectAllowed).toBe("move");

    vi.unstubAllGlobals();
  });
});
