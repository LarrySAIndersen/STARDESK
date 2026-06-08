"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Plus, StickyNote, Ticket, X } from "lucide-react";

import { PersonalNoteCard } from "@/components/personal/personal-note-card";
import { usePostItAttach } from "@/components/personal/post-it-attach-provider";
import { WirePriorityBadge, WireStatusBadge } from "@/components/wireframe/wire-badge";
import { Button } from "@/components/ui/button";
import { usePersonalNoteDrag } from "@/hooks/use-personal-note-drag";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import {
  PERSONAL_NOTE_COLORS,
  personalNoteColorClass,
  type PersonalNoteColorId,
} from "@/lib/personal-note-colors";
import { cn } from "@/lib/utils";
import { PERSONAL_KANBAN_COLUMNS, type PersonalKanban, type PersonalNote } from "@/types/personal";
import type { Ticket as TicketType } from "@/types/ticket";

const PINNED_QUEUE_COLUMN = PERSONAL_KANBAN_COLUMNS[0];

const STACK_OFFSETS = [
  { rotate: -3.5, x: 0, y: 0 },
  { rotate: 2.2, x: 6, y: 8 },
  { rotate: -1.8, x: 10, y: 16 },
  { rotate: 2.8, x: 4, y: 24 },
] as const;

const BOARD_FALLBACK_POSITIONS = [
  { x: 24, y: 28, rotate: -2.4 },
  { x: 210, y: 48, rotate: 1.8 },
  { x: 120, y: 140, rotate: -1.1 },
  { x: 300, y: 120, rotate: 2.2 },
  { x: 48, y: 220, rotate: -0.8 },
  { x: 240, y: 240, rotate: 1.4 },
] as const;

function ticketById(tickets: TicketType[], id: string): TicketType | undefined {
  return tickets.find((t) => t.id === id);
}

function boardPositionForNote(note: PersonalNote, index: number) {
  if (note.board_x != null && note.board_y != null) {
    return { x: note.board_x, y: note.board_y };
  }
  const fallback = BOARD_FALLBACK_POSITIONS[index % BOARD_FALLBACK_POSITIONS.length];
  return { x: fallback.x, y: fallback.y };
}

function boardRotationForNote(note: PersonalNote, index: number) {
  const fallback = BOARD_FALLBACK_POSITIONS[index % BOARD_FALLBACK_POSITIONS.length];
  return fallback.rotate;
}

export function PersonalBoard({
  notes,
  onNotesChange,
  kanban,
  onKanbanRefresh,
}: {
  notes: PersonalNote[];
  onNotesChange: (notes: PersonalNote[]) => void;
  kanban: PersonalKanban;
  onKanbanRefresh: () => Promise<void>;
}) {
  const { requestAttach } = usePostItAttach();
  const [busy, setBusy] = useState(false);

  const stackNotes = useMemo(
    () =>
      [...notes]
        .filter((n) => !n.is_pinned)
        .sort((a, b) => a.sort_order - b.sort_order || b.updated_at.localeCompare(a.updated_at)),
    [notes],
  );

  const boardNotes = useMemo(
    () =>
      [...notes]
        .filter((n) => n.is_pinned)
        .sort((a, b) => a.sort_order - b.sort_order || b.updated_at.localeCompare(a.updated_at)),
    [notes],
  );

  const queueTickets = useMemo(() => {
    const cards = kanban.cards
      .filter((c) => c.column_name === PINNED_QUEUE_COLUMN)
      .sort((a, b) => a.sort_order - b.sort_order);
    return cards.flatMap((card) => {
      const ticket = ticketById(kanban.tickets, card.ticket_id);
      return ticket ? [{ ticket, ticketId: card.ticket_id }] : [];
    });
  }, [kanban.cards, kanban.tickets]);

  const updateNote = useCallback(
    (updated: PersonalNote) => {
      onNotesChange(notes.map((n) => (n.id === updated.id ? updated : n)));
    },
    [notes, onNotesChange],
  );

  const pinNote = useCallback(
    async (noteId: string, boardX?: number, boardY?: number) => {
      const updated = await apiPatch<PersonalNote>(`/api/v1/personal/notes/${noteId}`, {
        is_pinned: true,
        board_x: boardX ?? 32,
        board_y: boardY ?? 32,
      });
      updateNote(updated);
    },
    [updateNote],
  );

  const moveNoteOnBoard = useCallback(
    async (noteId: string, boardX: number, boardY: number) => {
      const updated = await apiPatch<PersonalNote>(`/api/v1/personal/notes/${noteId}`, {
        board_x: boardX,
        board_y: boardY,
      });
      updateNote(updated);
    },
    [updateNote],
  );

  const unpinNote = useCallback(
    async (noteId: string) => {
      const updated = await apiPatch<PersonalNote>(`/api/v1/personal/notes/${noteId}`, {
        is_pinned: false,
        board_x: null,
        board_y: null,
      });
      updateNote(updated);
    },
    [updateNote],
  );

  const removeTicket = useCallback(
    async (ticketId: string) => {
      await apiDelete(`/api/v1/personal/kanban/cards/${ticketId}`);
      await onKanbanRefresh();
    },
    [onKanbanRefresh],
  );

  const createNote = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const color = PERSONAL_NOTE_COLORS[notes.length % PERSONAL_NOTE_COLORS.length]
        .id as PersonalNoteColorId;
      const created = await apiPost<PersonalNote>("/api/v1/personal/notes", {
        title: "Ny idé",
        content: "",
        color,
      });
      onNotesChange([...notes, created]);
    } finally {
      setBusy(false);
    }
  }, [busy, notes, onNotesChange]);

  const handleDrop = useCallback(
    (
      noteId: string,
      target: {
        zone: "stack" | "board" | "ticket";
        ticketId?: string;
        ticketNumber?: string;
        ticketTitle?: string;
        boardX?: number;
        boardY?: number;
      },
    ) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;

      if (target.zone === "board") {
        const x = target.boardX ?? 32;
        const y = target.boardY ?? 32;
        if (note.is_pinned) {
          void moveNoteOnBoard(noteId, x, y).catch(() => {});
        } else {
          void pinNote(noteId, x, y).catch(() => {});
        }
        return;
      }
      if (target.zone === "stack") {
        void unpinNote(noteId).catch(() => {});
        return;
      }
      if (target.zone === "ticket" && target.ticketId && target.ticketNumber && target.ticketTitle) {
        requestAttach({
          noteId,
          ticketId: target.ticketId,
          ticketNumber: target.ticketNumber,
          ticketTitle: target.ticketTitle,
        });
      }
    },
    [moveNoteOnBoard, notes, pinNote, requestAttach, unpinNote],
  );

  const { drag, startDrag, isZoneActive, isDragging } = usePersonalNoteDrag(handleDrop);

  const draggingNote = drag ? notes.find((n) => n.id === drag.noteId) : undefined;
  const topStackNote = stackNotes[0];
  const underStackNotes = stackNotes.slice(1, 4);

  return (
    <section className="min-side-board">
      <header className="min-side-board__header">
        <div className="min-side-board__title-row">
          <StickyNote className="size-4 shrink-0" aria-hidden />
          <h2 className="min-side-board__title">Min opslagstavle</h2>
          <span className="min-side-board__count">{boardNotes.length + queueTickets.length}</span>
        </div>
        <p className="min-side-board__subtitle">
          Træk idéer fra bunken til korken — eller fastgør dem på en sag til højre.
        </p>
      </header>

      <div className={cn("min-side-board__grid", isDragging && "min-side-board__grid--dragging")}>
        <div
          className={cn(
            "min-side-board__zone min-side-board__zone--stack",
            isZoneActive("stack") && "min-side-board__zone--active",
          )}
          data-note-drop="stack"
        >
          <p className="min-side-board__zone-label">Bunke</p>
          <div className="min-side-board__stack-pile">
            {stackNotes.length === 0 ? (
              <p className="min-side-board__empty min-side-board__empty--pile">
                {busy ? "Opretter idé…" : "Ingen idéer i bunken"}
              </p>
            ) : (
              <>
                {underStackNotes.map((note, index) => {
                  const layerIndex = stackNotes.length - 1 - index;
                  const offset = STACK_OFFSETS[layerIndex] ?? STACK_OFFSETS[3];
                  return (
                    <div
                      key={note.id}
                      className={cn(
                        "min-side-board__stack-sheet post-it-note",
                        personalNoteColorClass(note.color),
                      )}
                      style={{
                        zIndex: layerIndex + 1,
                        transform: `rotate(${offset.rotate}deg) translate(${offset.x}px, ${offset.y}px)`,
                      }}
                      aria-hidden
                    >
                      <span className="min-side-board__stack-peek">{note.title}</span>
                    </div>
                  );
                })}
                {topStackNote ? (
                  <div
                    className="min-side-board__stack-top"
                    style={{ zIndex: 10 }}
                  >
                    <PersonalNoteCard
                      note={topStackNote}
                      variant="stack"
                      dragging={drag?.noteId === topStackNote.id}
                      onNoteUpdated={updateNote}
                      onDelete={() =>
                        void apiDelete(`/api/v1/personal/notes/${topStackNote.id}`)
                          .then(() => onNotesChange(notes.filter((n) => n.id !== topStackNote.id)))
                          .catch(() => {})
                      }
                      onDragStart={startDrag}
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-side-board__add"
            disabled={busy}
            onClick={() => void createNote()}
          >
            <Plus className="size-3.5" aria-hidden />
            Ny idé
          </Button>
        </div>

        <div
          className={cn(
            "min-side-board__zone min-side-board__zone--cork",
            isZoneActive("board") && "min-side-board__zone--active",
          )}
          data-note-drop="board"
        >
          <p className="min-side-board__zone-label">Opslagstavle</p>
          <div className="min-side-board__cork-surface">
            {boardNotes.length === 0 ? (
              <div className="min-side-board__cork-empty">
                <p className="min-side-board__cork-empty-title">Slip idéer her</p>
                <p className="min-side-board__cork-empty-hint">
                  Brug grebet på sedlen og træk den hertil.
                </p>
              </div>
            ) : null}
            {boardNotes.map((note, index) => {
              const position = boardPositionForNote(note, index);
              const rotate = boardRotationForNote(note, index);
              return (
                <div
                  key={note.id}
                  className={cn(
                    "min-side-board__cork-note",
                    drag?.noteId === note.id && "min-side-board__cork-note--dragging",
                  )}
                  style={{
                    left: position.x,
                    top: position.y,
                    transform: `rotate(${rotate}deg)`,
                    zIndex: drag?.noteId === note.id ? 1 : index + 2,
                  }}
                >
                  <PersonalNoteCard
                    note={note}
                    variant="board"
                    dragging={drag?.noteId === note.id}
                    onNoteUpdated={updateNote}
                    onDragStart={startDrag}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-side-board__zone min-side-board__zone--tickets">
          <p className="min-side-board__zone-label">Fastgjorte sager</p>
          {queueTickets.length === 0 ? (
            <p className="min-side-board__empty">Træk sager hertil fra kanban</p>
          ) : (
            <ul className="min-side-board__ticket-list">
              {queueTickets.map(({ ticket, ticketId }) => (
                <li
                  key={ticketId}
                  className={cn(
                    "min-side-board__ticket-item",
                    isZoneActive("ticket", ticketId) && "min-side-board__ticket-item--active",
                  )}
                  data-note-drop="ticket"
                  data-ticket-id={ticket.id}
                  data-ticket-number={ticket.ticket_number}
                  data-ticket-title={ticket.title}
                >
                  <article className="min-side-board__ticket-card">
                    <div className="min-side-board__ticket-top">
                      <Ticket className="size-3.5 opacity-60" aria-hidden />
                      <Link href={`/tickets/${ticket.id}`} className="min-side-board__ticket-number">
                        {ticket.ticket_number}
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto size-7"
                        aria-label="Fjern fra tavlen"
                        onClick={() => void removeTicket(ticketId).catch(() => {})}
                      >
                        <X className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                    <p className="min-side-board__ticket-title">{ticket.title}</p>
                    <div className="min-side-board__ticket-badges">
                      <WireStatusBadge status={ticket.status} />
                      <WirePriorityBadge priority={ticket.priority} />
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
          <p className="min-side-board__ticket-hint">Slip en idé på en sag for at fastgøre den.</p>
        </div>
      </div>

      {draggingNote && drag ? (
        <div
          className="min-side-board__ghost"
          style={{ left: drag.x + 12, top: drag.y + 12 }}
          aria-hidden
        >
          <PersonalNoteCard note={draggingNote} variant="stack" dragging onNoteUpdated={() => {}} />
        </div>
      ) : null}
    </section>
  );
}
