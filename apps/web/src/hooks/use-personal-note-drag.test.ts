import { describe, expect, it } from "vitest";

import { resolvePersonalNoteDropTarget } from "./use-personal-note-drag";

function mockDropElement(
  zone: string,
  extras: Record<string, string> = {},
): HTMLElement {
  const el = {
    dataset: { noteDrop: zone, ...extras },
  } as HTMLElement;
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
});