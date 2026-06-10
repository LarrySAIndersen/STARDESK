"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Pin, StickyNote } from "lucide-react";

import { apiGet } from "@/lib/api";
import { personalNoteColorClass } from "@/lib/personal-note-colors";
import { cn } from "@/lib/utils";
import { PERSONAL_KANBAN_COLUMNS, type PersonalKanban, type PersonalNote } from "@/types/personal";
import type { Ticket } from "@/types/ticket";

function ticketById(tickets: Ticket[], id: string): Ticket | undefined {
  return tickets.find((t) => t.id === id);
}

export function PinnedNotesSidebar({ collapsed }: { collapsed: boolean }) {
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [queueTickets, setQueueTickets] = useState<Ticket[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadBoard = useCallback(async () => {
    try {
      const [noteData, kanbanData] = await Promise.all([
        apiGet<PersonalNote[]>("/api/v1/personal/notes"),
        apiGet<PersonalKanban>("/api/v1/personal/kanban"),
      ]);
      setNotes(noteData.filter((n) => n.is_pinned));
      const queueColumn = PERSONAL_KANBAN_COLUMNS[0];
      const ids = kanbanData.cards
        .filter((c) => c.column_name === queueColumn)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => c.ticket_id);
      setQueueTickets(
        ids
          .map((id) => ticketById(kanbanData.tickets, id))
          .filter((t): t is Ticket => t !== undefined),
      );
    } catch {
      setNotes([]);
      setQueueTickets([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fireAndForget(loadBoard());
  }, [loadBoard]);

  useEffect(() => {
    const onFocus = () => fireAndForget(loadBoard());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadBoard]);

  const itemCount = notes.length + queueTickets.length;
  if (!loaded || itemCount === 0) {
    return null;
  }

  if (collapsed) {
    return (
      <div className="border-t border-[var(--gray-border)] px-2 py-2">
        <Link
          href="/min-side"
          className="wire-nav-item wire-nav-item--compact flex items-center justify-center"
          title={`${itemCount} på opslagstavlen`}
          aria-label={`${itemCount} sedler og sager på Min side opslagstavle`}
        >
          <StickyNote className="size-[18px] shrink-0 text-star-navy opacity-80" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--gray-border)] px-3 py-2">
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold tracking-wide uppercase">
        <Pin className="size-3 shrink-0 opacity-70" aria-hidden />
        Opslagstavle
      </p>
      <ul className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
        {notes.map((note, index) => (
          <li key={note.id}>
            <Link
              href="/min-side"
              className={cn(
                "post-it-note post-it-note--sidebar block rounded-sm border px-2 py-1.5 text-xs leading-snug shadow-sm transition-transform hover:-translate-y-px hover:shadow-md",
                personalNoteColorClass(note.color),
                index % 2 === 0 ? "-rotate-[0.6deg]" : "rotate-[0.5deg]",
              )}
              title={note.content || `${note.note_number} — ${note.title}`}
            >
              <span className="text-star-blue text-[10px] font-bold">{note.note_number}</span>
              <span className="line-clamp-2 font-semibold">{note.title}</span>
            </Link>
          </li>
        ))}
        {queueTickets.map((ticket) => (
          <li key={ticket.id}>
            <Link
              href={`/tickets/${ticket.id}`}
              className="bulletin-ticket-card block rounded-sm border border-star-navy/20 bg-card px-2 py-1.5 text-xs shadow-sm transition-transform hover:-translate-y-px"
              title={ticket.title}
            >
              <span className="text-star-blue font-semibold">{ticket.ticket_number}</span>
              <span className="mt-0.5 block line-clamp-2 leading-snug">{ticket.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
