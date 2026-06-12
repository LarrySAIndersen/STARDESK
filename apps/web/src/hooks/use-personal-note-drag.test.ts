import { describe, expect, it } from "vitest";

import { resolvePersonalNoteDropTarget } from "./use-personal-note-drag";

function mockDropElement(
  zone: string,
  extras: Record<string, string> = {},
): HTMLElement {
  const el = {
    dataset: { noteDrop: zone, ...extras },
  } as unknown as HTMLElement;
  el.closest = (selector: string) => (selector === "[data-note-drop]" ? el : null);
  return el;
}

describe("resolvePersonalNoteDropTarget", () => {
  it("returns null when no drop target is under the pointer", () => {
    expect(resolvePersonalNoteDropTarget([])).toBeNull();
  });

  it("reads stack and board zones", () => {
    const stack = mockDropElement("stack");
    expect(resolvePersonalNoteDropTarget([stack])).toEqual({ zone: "stack" });
  });

  it("reads ticket zone with metadata", () => {
    const ticket = mockDropElement("ticket", {
      ticketId: "t-1",
      ticketNumber: "INC-1",
      ticketTitle: "Test sag",
    });
    expect(resolvePersonalNoteDropTarget([ticket])).toEqual({
      zone: "ticket",
      ticketId: "t-1",
      ticketNumber: "INC-1",
      ticketTitle: "Test sag",
    });
  });

  it("finds nearest ancestor with data-note-drop", () => {
    const zone = mockDropElement("board");
    const inner = {
      closest: (selector: string) => (selector === "[data-note-drop]" ? zone : null),
    } as unknown as HTMLElement;
    expect(resolvePersonalNoteDropTarget([inner])).toEqual({ zone: "board" });
  });

  it("computes board coordinates from pointer position", () => {
    const canvas = {
      offsetWidth: 800,
      offsetHeight: 600,
    } as HTMLElement;

    const viewport = {
      dataset: {
        boardZoom: "0.5",
        boardPanX: "10",
        boardPanY: "20",
        noteDrop: "board",
      },
      getBoundingClientRect: () => ({
        left: 100,
        top: 50,
        right: 900,
        bottom: 650,
        width: 800,
        height: 600,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      }),
      closest: () => null,
      querySelector: (selector: string) =>
        selector === "[data-cork-canvas]" ? canvas : null,
    } as unknown as HTMLElement;

    viewport.closest = (selector: string) =>
      selector === "[data-cork-viewport]" ? viewport : null;

    const boardZone = {
      dataset: { noteDrop: "board" },
      closest: (selector: string) => {
        if (selector === "[data-note-drop]") return boardZone as HTMLElement;
        if (selector === "[data-cork-viewport]") return viewport;
        return null;
      },
    } as unknown as HTMLElement;

    const result = resolvePersonalNoteDropTarget([boardZone], 300, 200);
    expect(result?.zone).toBe("board");
    expect(result?.boardX).toBeGreaterThanOrEqual(0);
    expect(result?.boardY).toBeGreaterThanOrEqual(0);
    expect(result?.boardX).toBeLessThanOrEqual(624);
    expect(result?.boardY).toBeLessThanOrEqual(480);
  });
});