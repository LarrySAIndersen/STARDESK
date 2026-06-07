"use client";

import Link from "next/link";
import { useState, type DragEvent } from "react";
import { PinOff, StickyNote, Ticket, X } from "lucide-react";

import { WirePriorityBadge, WireStatusBadge } from "@/components/wireframe/wire-badge";
import { Button } from "@/components/ui/button";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import {
  beginNoteDrag,
  endNoteDrag,
  isNoteDragActive,
  readDraggedNoteId,
  readDraggedTicketId,
  shouldBlockNoteDrag,
} from "@/lib/personal-board-dnd";
import { EditablePostItFields } from "@/components/personal/editable-post-it-fields";
import { PersonalNoteStack } from "@/components/personal/personal-note-stack";
import { TicketPostItDropTarget } from "@/components/personal/post-it-attach-provider";
import { personalNoteColorClass } from "@/lib/personal-note-colors";
import { cn } from "@/lib/utils";
import { PERSONAL_KANBAN_COLUMNS, type PersonalKanban, type PersonalNote } from "@/types/personal";
import type { Ticket as TicketType } from "@/types/ticket";

const PINNED_QUEUE_COLUMN = PERSONAL_KANBAN_COLUMNS[0];

const NOTE_SCATTER = [
  { rotate: -2.4, shift: "ml-0" },
  { rotate: 1.8, shift: "ml-2" },
  { rotate: -1.1, shift: "ml-1" },
  { rotate: 2.2, shift: "ml-3" },
  { rotate: -0.8, shift: "ml-1" },
  { rotate: 1.4, shift: "ml-2" },
] as const;

function ticketById(tickets: TicketType[], id: string): TicketType | undefined {
  return tickets.find((t) => t.id === id);
}

function BulletinPushpin({ className }: { className?: string }) {
  return <span className={cn("bulletin-pushpin", className)} aria-hidden />;
}

export function PersonalBulletinBoard({
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
  const pinnedNotes = [...notes]
    .filter((n) => n.is_pinned)
    .sort((a, b) => a.sort_order - b.sort_order || b.updated_at.localeCompare(a.updated_at));
  const [notesDropActive, setNotesDropActive] = useState(false);
  const [, setNotesDropDepth] = useState(0);
  const [ticketsDropActive, setTicketsDropActive] = useState(false);

  const queueCards = kanban.cards
    .filter((c) => c.column_name === PINNED_QUEUE_COLUMN)
    .sort((a, b) => a.sort_order - b.sort_order);

  const queueTickets = queueCards.flatMap((card) => {
    const ticket = ticketById(kanban.tickets, card.ticket_id);
    return ticket ? [{ ticket, ticketId: card.ticket_id }] : [];
  });

  const boardTicketIds = new Set(kanban.cards.map((c) => c.ticket_id));

  const totalCount = pinnedNotes.length + queueTickets.length;

  const pinNote = async (noteId: string) => {
    const updated = await apiPatch<PersonalNote>(`/api/v1/personal/notes/${noteId}`, {
      is_pinned: true,
    });
    onNotesChange(notes.map((n) => (n.id === noteId ? updated : n)));
  };

  const unpinNote = async (noteId: string) => {
    const updated = await apiPatch<PersonalNote>(`/api/v1/personal/notes/${noteId}`, {
      is_pinned: false,
    });
    onNotesChange(notes.map((n) => (n.id === noteId ? updated : n)));
  };

  const pinTicket = async (ticketId: string) => {
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
  };

  const removeFromBoard = async (ticketId: string) => {
    await apiDelete(`/api/v1/personal/kanban/cards/${ticketId}`);
    await onKanbanRefresh();
  };

  const handleNotesDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (!isNoteDragActive(e.dataTransfer)) return;
    e.preventDefault();
    setNotesDropDepth((depth) => {
      const next = depth + 1;
      if (next === 1) setNotesDropActive(true);
      return next;
    });
  };

  const handleNotesDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setNotesDropDepth(0);
    setNotesDropActive(false);
  };

  const handleNotesDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!isNoteDragActive(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleNotesDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setNotesDropDepth(0);
    setNotesDropActive(false);
    const noteId = readDraggedNoteId(e.dataTransfer);
    endNoteDrag();
    if (noteId) void pinNote(noteId).catch(() => {});
  };

  const handleTicketsDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setTicketsDropActive(true);
  };

  const handleTicketsDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setTicketsDropActive(false);
    const ticketId = readDraggedTicketId(e.dataTransfer);
    if (ticketId) void pinTicket(ticketId).catch(() => {});
  };

  return (
    <section className="bulletin-board-shell w-full">
      <div className="bulletin-board-frame">
        <header className="bulletin-board-frame__title">
          <StickyNote className="size-4 shrink-0 opacity-90" aria-hidden />
          <span>Min opslagstavle</span>
          {totalCount > 0 ? (
            <span className="bulletin-board-frame__count">{totalCount}</span>
          ) : null}
        </header>

        <div className="bulletin-board-body">
          <PersonalNoteStack
            notes={notes}
            onNotesChange={onNotesChange}
            onNoteDropToStack={(noteId) => void unpinNote(noteId).catch(() => {})}
          />
          <div className="bulletin-board-split">
          <div
            className={cn(
              "bulletin-board-surface bulletin-board-surface--notes",
              notesDropActive && "bulletin-board-surface--drop-active",
            )}
            aria-label="Opslagstavle — træk sedler hertil"
            onDragEnter={handleNotesDragEnter}
            onDragOver={handleNotesDragOver}
            onDragLeave={handleNotesDragLeave}
            onDrop={handleNotesDrop}
          >
            <p className="bulletin-board-zone-label">Opslagstavle · træk sedler hertil</p>
            {pinnedNotes.length === 0 ? (
              <div className="bulletin-board-empty bulletin-board-empty--compact">
                <div
                  className="bulletin-board-empty__ghost bulletin-board-empty__ghost--a"
                  aria-hidden
                />
                <div
                  className="bulletin-board-empty__ghost bulletin-board-empty__ghost--b"
                  aria-hidden
                />
                <p className="bulletin-board-empty__title">Træk sedler hertil</p>
                <p className="bulletin-board-empty__hint">
                  Tag en seddel fra bunken til venstre og slip den på korken.
                </p>
              </div>
            ) : (
              <ul className="bulletin-board-mosaic bulletin-board-mosaic--notes">
                {pinnedNotes.map((note, index) => {
                  const scatter = NOTE_SCATTER[index % NOTE_SCATTER.length];
                  return (
                    <li
                      key={note.id}
                      draggable
                      onDragStart={(e) => {
                        if (shouldBlockNoteDrag(e.target)) {
                          e.preventDefault();
                          return;
                        }
                        beginNoteDrag(e.dataTransfer, note.id);
                      }}
                      onDragEnd={() => endNoteDrag()}
                      className={cn(
                        "bulletin-board-mosaic__item group cursor-grab active:cursor-grabbing",
                        scatter.shift,
                      )}
                      style={{ transform: `rotate(${scatter.rotate}deg)` }}
                    >
                      <article
                        className={cn(
                          "bulletin-post-it post-it-note",
                          personalNoteColorClass(note.color),
                        )}
                      >
                        <BulletinPushpin />
                        <div className="bulletin-post-it__actions" data-no-drag>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="bulletin-board-action"
                            aria-label="Frigør seddel fra tavlen"
                            onClick={() => void unpinNote(note.id).catch(() => {})}
                          >
                            <PinOff className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                        <EditablePostItFields
                          note={note}
                          onNoteUpdated={(updated) =>
                            onNotesChange(notes.map((n) => (n.id === updated.id ? updated : n)))
                          }
                        />
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div
            className={cn(
              "bulletin-board-surface bulletin-board-surface--tickets",
              ticketsDropActive && "bulletin-board-surface--drop-active",
            )}
            aria-label="Fastgjorte sager — træk sager hertil"
            onDragOver={handleTicketsDragOver}
            onDragLeave={() => setTicketsDropActive(false)}
            onDrop={handleTicketsDrop}
          >
            <p className="bulletin-board-zone-label">Fastgjorte sager · træk hertil</p>
            {queueTickets.length === 0 ? (
              <div className="bulletin-board-empty bulletin-board-empty--compact">
                <p className="bulletin-board-empty__title">Træk sager hertil</p>
                <p className="bulletin-board-empty__hint">
                  Træk en sag fra kanban eller listen nedenfor.
                </p>
              </div>
            ) : (
              <ul className="bulletin-board-ticket-list">
                {queueTickets.map(({ ticket, ticketId }) => (
                  <li key={ticketId} className="bulletin-board-ticket-list__item group">
                    <TicketPostItDropTarget
                      ticketId={ticket.id}
                      ticketNumber={ticket.ticket_number}
                      ticketTitle={ticket.title}
                    >
                    <article className="bulletin-ticket-slip bulletin-ticket-slip--stacked">
                      <BulletinPushpin />
                      <div className="bulletin-post-it__actions">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="bulletin-board-action"
                          aria-label="Fjern sag fra tavlen"
                          onClick={() => void removeFromBoard(ticketId).catch(() => {})}
                        >
                          <X className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                      <div className="bulletin-ticket-slip__meta">
                        <Ticket className="size-3 shrink-0 opacity-60" aria-hidden />
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="bulletin-ticket-slip__number hover:underline"
                        >
                          {ticket.ticket_number}
                        </Link>
                      </div>
                      <p className="bulletin-ticket-slip__title">{ticket.title}</p>
                      <div className="bulletin-ticket-slip__badges">
                        <WireStatusBadge status={ticket.status} />
                        <WirePriorityBadge priority={ticket.priority} />
                      </div>
                    </article>
                    </TicketPostItDropTarget>
                  </li>
                ))}
              </ul>
            )}
            <p className="bulletin-board-zone-hint">Træk en seddel hertil for at fastgøre den på en sag.</p>
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}
