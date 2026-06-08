"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Plus, StickyNote, Ticket, X } from "lucide-react";

import { PersonalNoteCard } from "@/components/personal/personal-note-card";
import { usePostItAttach } from "@/components/personal/post-it-attach-provider";
import { WirePriorityBadge, WireStatusBadge } from "@/components/wireframe/wire-badge";
import { Button } from "@/components/ui/button";
import { usePersonalNoteDrag } from "@/hooks/use-personal-note-drag";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { PERSONAL_KANBAN_DRAG_MIME, readDraggedTicketId } from "@/lib/personal-board-dnd";
import {
  PERSONAL_NOTE_COLORS,
  type PersonalNoteColorId,
} from "@/lib/personal-note-colors";
import { cn } from "@/lib/utils";
import { PERSONAL_KANBAN_COLUMNS, type PersonalKanban, type PersonalNote } from "@/types/personal";
import type { Ticket as TicketType } from "@/types/ticket";

const PINNED_QUEUE_COLUMN = PERSONAL_KANBAN_COLUMNS[0];

function ticketById(tickets: TicketType[], id: string): TicketType | undefined {
  return tickets.find((t) => t.id === id);
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
  const [createError, setCreateError] = useState<string | null>(null);
  const [ticketDropActive, setTicketDropActive] = useState(false);
  const bootstrappedRef = useRef(false);

  const boardTicketIds = useMemo(
    () => new Set(kanban.cards.map((c) => c.ticket_id)),
    [kanban.cards],
  );

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

  const pinNote = useCallback(
    async (noteId: string) => {
      const updated = await apiPatch<PersonalNote>(`/api/v1/personal/notes/${noteId}`, {
        is_pinned: true,
      });
      onNotesChange(notes.map((n) => (n.id === noteId ? updated : n)));
    },
    [notes, onNotesChange],
  );

  const unpinNote = useCallback(
    async (noteId: string) => {
      const updated = await apiPatch<PersonalNote>(`/api/v1/personal/notes/${noteId}`, {
        is_pinned: false,
      });
      onNotesChange(notes.map((n) => (n.id === noteId ? updated : n)));
    },
    [notes, onNotesChange],
  );

  const removeTicket = useCallback(
    async (ticketId: string) => {
      await apiDelete(`/api/v1/personal/kanban/cards/${ticketId}`);
      await onKanbanRefresh();
    },
    [onKanbanRefresh],
  );

  const pinTicketToQueue = useCallback(
    async (ticketId: string) => {
      if (boardTicketIds.has(ticketId)) {
        await apiPatch(`/api/v1/personal/kanban/cards/${ticketId}`, {
          column_name: PINNED_QUEUE_COLUMN,
        });
      } else {
        await apiPost("/api/v1/personal/kanban/cards", {
          ticket_id: ticketId,
          column_name: PINNED_QUEUE_COLUMN,
        });
      }
      await onKanbanRefresh();
    },
    [boardTicketIds, onKanbanRefresh],
  );

  const createNote = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setCreateError(null);
    try {
      const color = PERSONAL_NOTE_COLORS[notes.length % PERSONAL_NOTE_COLORS.length]
        .id as PersonalNoteColorId;
      const created = await apiPost<PersonalNote>("/api/v1/personal/notes", {
        title: "Ny idé",
        content: "",
        color,
      });
      onNotesChange([...notes, created]);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Kunne ikke oprette idé");
    } finally {
      setBusy(false);
    }
  }, [busy, notes, onNotesChange]);

  useEffect(() => {
    if (bootstrappedRef.current || notes.length > 0 || busy) return;
    bootstrappedRef.current = true;
    void createNote();
  }, [busy, createNote, notes.length]);

  const handleDrop = useCallback(
    (
      noteId: string,
      target: {
        zone: "stack" | "board" | "ticket";
        ticketId?: string;
        ticketNumber?: string;
        ticketTitle?: string;
      },
    ) => {
      if (target.zone === "board") {
        void pinNote(noteId).catch(() => {});
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
    [pinNote, requestAttach, unpinNote],
  );

  const { drag, startDrag, isZoneActive, isDragging } = usePersonalNoteDrag(handleDrop);

  const draggingNote = drag ? notes.find((n) => n.id === drag.noteId) : undefined;

  const handleTicketDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setTicketDropActive(true);
  };

  const handleTicketDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setTicketDropActive(false);
    const ticketId = readDraggedTicketId(event.dataTransfer);
    if (ticketId) void pinTicketToQueue(ticketId).catch(() => {});
  };

  const isKanbanDrag = (event: DragEvent<HTMLDivElement>) =>
    event.dataTransfer.types.includes(PERSONAL_KANBAN_DRAG_MIME) ||
    event.dataTransfer.types.includes("text/plain");

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
          <div className="min-side-board__stack-list">
            {stackNotes.length === 0 ? (
              <p className="min-side-board__empty">
                {busy ? "Opretter idé…" : "Ingen idéer i bunken — klik Ny idé"}
              </p>
            ) : (
              stackNotes.map((note) => (
                <PersonalNoteCard
                  key={note.id}
                  note={note}
                  variant="stack"
                  dragging={drag?.noteId === note.id}
                  onNoteUpdated={(updated) =>
                    onNotesChange(notes.map((n) => (n.id === updated.id ? updated : n)))
                  }
                  onPinToBoard={() => void pinNote(note.id).catch(() => {})}
                  onDelete={() =>
                    void apiDelete(`/api/v1/personal/notes/${note.id}`)
                      .then(() => onNotesChange(notes.filter((n) => n.id !== note.id)))
                      .catch(() => {})
                  }
                  onDragStart={startDrag}
                />
              ))
            )}
          </div>
          {createError ? <p className="min-side-board__error">{createError}</p> : null}
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
          {boardNotes.length === 0 ? (
            <div className="min-side-board__cork-empty">
              <p className="min-side-board__cork-empty-title">Slip idéer her</p>
              <p className="min-side-board__cork-empty-hint">
                Brug grebet på sedlen og træk den hertil.
              </p>
            </div>
          ) : (
            <div className="min-side-board__cork-grid">
              {boardNotes.map((note) => (
                <PersonalNoteCard
                  key={note.id}
                  note={note}
                  variant="board"
                  dragging={drag?.noteId === note.id}
                  onNoteUpdated={(updated) =>
                    onNotesChange(notes.map((n) => (n.id === updated.id ? updated : n)))
                  }
                  onDragStart={startDrag}
                />
              ))}
            </div>
          )}
        </div>

        <div
          className={cn(
            "min-side-board__zone min-side-board__zone--tickets",
            (ticketDropActive || isZoneActive("ticket")) && "min-side-board__zone--active",
          )}
          data-ticket-drop="queue"
          onDragEnter={(event) => {
            if (!isKanbanDrag(event)) return;
            event.preventDefault();
            setTicketDropActive(true);
          }}
          onDragOver={handleTicketDragOver}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setTicketDropActive(false);
            }
          }}
          onDrop={handleTicketDrop}
        >
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
