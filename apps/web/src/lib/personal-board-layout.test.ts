import { describe, expect, it } from "vitest";

import {
  adjustCorkZoom,
  boardPositionForNote,
  boardRotationForNote,
  CORK_MAX_ZOOM,
  CORK_MIN_ZOOM,
  clampCorkZoom,
  sortBoardNotes,
  sortStackNotes,
  noteTrayStackOffsetForIndex,
  pickPersonalNoteColorId,
  stackOffsetForIndex,
  ticketById,
} from "@/lib/personal-board-layout";
import type { PersonalNote } from "@/types/personal";

function note(partial: Partial<PersonalNote> & Pick<PersonalNote, "id">): PersonalNote {
  return {
    id: partial.id,
    user_id: partial.user_id ?? "u1",
    note_number: partial.note_number ?? "N-1",
    title: partial.title ?? "Note",
    content: partial.content ?? "",
    color: partial.color ?? "yellow",
    category: partial.category ?? null,
    sort_order: partial.sort_order ?? 0,
    is_pinned: partial.is_pinned ?? false,
    board_x: partial.board_x ?? null,
    board_y: partial.board_y ?? null,
    ticket_id: partial.ticket_id ?? null,
    ticket_number: partial.ticket_number ?? null,
    visibility: partial.visibility ?? "private",
    author_name: partial.author_name ?? null,
    created_at: partial.created_at ?? "2026-01-01T00:00:00Z",
    updated_at: partial.updated_at ?? "2026-06-01T00:00:00Z",
  };
}

describe("personal-board-layout", () => {
  it("finds tickets by id", () => {
    const tickets = [{ id: "t1", ticket_number: "INC-1" } as { id: string }];
    expect(ticketById(tickets, "t1")?.id).toBe("t1");
    expect(ticketById(tickets, "missing")).toBeUndefined();
  });

  it("uses board coordinates or fallback layout", () => {
    const positioned = note({ id: "n1", board_x: 50, board_y: 60 });
    expect(boardPositionForNote(positioned, 0)).toEqual({ x: 50, y: 60 });

    const fallback = note({ id: "n2" });
    const pos = boardPositionForNote(fallback, 1);
    expect(pos.x).toBeGreaterThan(0);
    expect(boardRotationForNote(fallback, 1)).not.toBe(0);
  });

  it("sorts stack and board notes", () => {
    const notes = [
      note({ id: "a", is_pinned: false, sort_order: 2, updated_at: "2026-06-02T00:00:00Z" }),
      note({ id: "b", is_pinned: true, sort_order: 1, updated_at: "2026-06-03T00:00:00Z" }),
      note({ id: "c", is_pinned: false, sort_order: 1, updated_at: "2026-06-04T00:00:00Z" }),
    ];

    expect(sortStackNotes(notes).map((n) => n.id)).toEqual(["c", "a"]);
    expect(sortBoardNotes(notes).map((n) => n.id)).toEqual(["b"]);
  });

  it("clamps cork zoom and steps in/out", () => {
    expect(clampCorkZoom(0.1)).toBe(CORK_MIN_ZOOM);
    expect(clampCorkZoom(2)).toBe(CORK_MAX_ZOOM);
    expect(adjustCorkZoom(1, "in")).toBeGreaterThan(1);
    expect(adjustCorkZoom(1, "out")).toBeLessThan(1);
  });

  it("returns tray stack offsets and note color rotation", () => {
    expect(noteTrayStackOffsetForIndex(0).rotate).toBe(-4);
    expect(pickPersonalNoteColorId([{ id: "red" }, { id: "blue" }], 3)).toBe("blue");
  });

  it("returns stack offsets cyclically", () => {
    const first = stackOffsetForIndex(0);
    const second = stackOffsetForIndex(1);
    const wrapped = stackOffsetForIndex(5);
    expect(first.rotate).toBe(-3.5);
    expect(wrapped).toEqual(second);
  });
});
