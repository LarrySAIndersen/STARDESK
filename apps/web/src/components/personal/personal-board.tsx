"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { Plus, StickyNote, Ticket, X, ZoomIn, ZoomOut } from "lucide-react";

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

const CORK_MIN_ZOOM = 0.32;
const CORK_MAX_ZOOM = 1.75;
const CORK_DEFAULT_ZOOM = 0.32;
const CORK_ZOOM_STEP = 0.08;

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
  notesLoadFailed = false,
}: {
  notes: PersonalNote[];
  onNotesChange: (notes: PersonalNote[]) => void;
  kanban: PersonalKanban;
  onKanbanRefresh: () => Promise<void>;
  notesLoadFailed?: boolean;
}) {
  const { requestAttach } = usePostItAttach();
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [corkZoom, setCorkZoom] = useState(CORK_DEFAULT_ZOOM);
  const [corkPan, setCorkPan] = useState({ x: 0, y: 0 });
  const corkPanDragRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);

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
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Kunne ikke oprette idé — prøv igen om lidt.",
      );
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
          fireAndForget(moveNoteOnBoard(noteId, x, y).catch(() => {}));
        } else {
          fireAndForget(pinNote(noteId, x, y).catch(() => {}));
        }
        return;
      }
      if (target.zone === "stack") {
        fireAndForget(unpinNote(noteId).catch(() => {}));
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

  const handleCorkWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -CORK_ZOOM_STEP : CORK_ZOOM_STEP;
    setCorkZoom((current) =>
      Math.min(CORK_MAX_ZOOM, Math.max(CORK_MIN_ZOOM, current + delta)),
    );
  }, []);

  const handleCorkPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || isDragging) return;
      if (
        (event.target as HTMLElement).closest(
          ".min-side-board__cork-note, .min-side-note, button, input, textarea, a, [data-no-drag]",
        )
      ) {
        return;
      }
      corkPanDragRef.current = {
        x: event.clientX,
        y: event.clientY,
        panX: corkPan.x,
        panY: corkPan.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [corkPan.x, corkPan.y, isDragging],
  );

  const handleCorkPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const panDrag = corkPanDragRef.current;
    if (!panDrag) return;
    setCorkPan({
      x: panDrag.panX + (event.clientX - panDrag.x),
      y: panDrag.panY + (event.clientY - panDrag.y),
    });
  }, []);

  const handleCorkPointerUp = useCallback(() => {
    corkPanDragRef.current = null;
  }, []);

  const resetCorkView = useCallback(() => {
    setCorkZoom(CORK_DEFAULT_ZOOM);
    setCorkPan({ x: 0, y: 0 });
  }, []);

  const zoomCorkIn = useCallback(() => {
    setCorkZoom((current) => Math.min(CORK_MAX_ZOOM, current + CORK_ZOOM_STEP));
  }, []);

  const zoomCorkOut = useCallback(() => {
    setCorkZoom((current) => Math.max(CORK_MIN_ZOOM, current - CORK_ZOOM_STEP));
  }, []);

  const draggingNote = drag ? notes.find((n) => n.id === drag.noteId) : undefined;
  const corkZoomLabel = `${Math.round(corkZoom * 100)}%`;
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
          Træk idéer fra bunken til korken — scroll på tavlen for at zoome ind.
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
              <div className="min-side-board__empty min-side-board__empty--pile">
                <p>
                  {busy
                    ? "Opretter idé…"
                    : notesLoadFailed
                      ? "Kunne ikke hente idéer"
                      : "Ingen idéer i bunken — klik Ny idé"}
                </p>
                {notesLoadFailed ? (
                  <p className="text-destructive mt-2 text-xs" role="alert">
                    API/database mangler migration. Kontakt admin eller prøv igen senere.
                  </p>
                ) : null}
                {createError ? (
                  <p className="text-destructive mt-2 text-xs" role="alert">
                    {createError}
                  </p>
                ) : null}
              </div>
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
                        fireAndForget(
                          apiDelete(`/api/v1/personal/notes/${topStackNote.id}`).then(() =>
                            onNotesChange(notes.filter((n) => n.id !== topStackNote.id)),
                          ),
                        )
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
            onClick={() => fireAndForget(createNote())}
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
        >
          <div className="min-side-board__cork-header">
            <p className="min-side-board__zone-label">Opslagstavle</p>
            <div className="min-side-board__cork-zoom-controls">
              <span className="min-side-board__cork-zoom-label">{corkZoomLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-side-board__cork-zoom-btn"
                aria-label="Zoom ud"
                onClick={zoomCorkOut}
                disabled={corkZoom <= CORK_MIN_ZOOM}
              >
                <ZoomOut className="size-3.5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-side-board__cork-zoom-btn"
                aria-label="Zoom ind"
                onClick={zoomCorkIn}
                disabled={corkZoom >= CORK_MAX_ZOOM}
              >
                <ZoomIn className="size-3.5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-side-board__cork-reset-btn"
                onClick={resetCorkView}
              >
                Nulstil
              </Button>
            </div>
          </div>
          <div
            className="min-side-board__cork-viewport"
            data-cork-viewport
            data-note-drop="board"
            data-board-zoom={corkZoom}
            data-board-pan-x={corkPan.x}
            data-board-pan-y={corkPan.y}
            onWheel={handleCorkWheel}
            onPointerDown={handleCorkPointerDown}
            onPointerMove={handleCorkPointerMove}
            onPointerUp={handleCorkPointerUp}
            onPointerCancel={handleCorkPointerUp}
            aria-label="Opslagstavle — scroll for at zoome, træk for at panorere"
          >
            <div
              className="min-side-board__cork-canvas"
              data-cork-canvas
              style={{
                transform: `translate(${corkPan.x}px, ${corkPan.y}px) scale(${corkZoom})`,
              }}
            >
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
            <p className="min-side-board__cork-zoom-hint">Scroll for at zoome · træk for at flytte</p>
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
                        onClick={() => fireAndForget(removeTicket(ticketId).catch(() => {}))}
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
