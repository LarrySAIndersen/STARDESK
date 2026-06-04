"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ExternalLink, X } from "lucide-react";

import { WirePriorityBadge, WireStatusBadge } from "@/components/wireframe/wire-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PersonalKanban } from "@/types/personal";
import type { Ticket } from "@/types/ticket";
import type { UserTicketsGrouped } from "@/types/admin-user";

const DRAG_MIME = "application/x-stardesk-personal-kanban";

function ticketById(tickets: Ticket[], id: string): Ticket | undefined {
  return tickets.find((t) => t.id === id);
}

export function PersonalKanbanBoard({
  initialKanban,
  assignableTickets,
}: {
  initialKanban: PersonalKanban;
  assignableTickets: Ticket[];
}) {
  const [kanban, setKanban] = useState(initialKanban);
  const [dragTicketId, setDragTicketId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, typeof kanban.cards>();
    for (const col of kanban.columns) {
      map.set(
        col,
        kanban.cards
          .filter((c) => c.column_name === col)
          .sort((a, b) => a.sort_order - b.sort_order),
      );
    }
    return map;
  }, [kanban]);

  const boardTicketIds = useMemo(() => new Set(kanban.cards.map((c) => c.ticket_id)), [kanban.cards]);

  const availableTickets = useMemo(
    () => assignableTickets.filter((t) => !boardTicketIds.has(t.id)),
    [assignableTickets, boardTicketIds],
  );

  const refreshKanban = useCallback(async () => {
    const res = await fetch("/api/proxy/v1/personal/kanban", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as PersonalKanban;
    setKanban(data);
  }, []);

  const addTicket = useCallback(
    async (ticketId: string, columnName: string) => {
      setBusy(true);
      try {
        await apiPost("/api/v1/personal/kanban/cards", {
          ticket_id: ticketId,
          column_name: columnName,
        });
        await refreshKanban();
      } finally {
        setBusy(false);
      }
    },
    [refreshKanban],
  );

  const moveTicket = useCallback(
    async (ticketId: string, columnName: string) => {
      setBusy(true);
      try {
        await apiPatch(`/api/v1/personal/kanban/cards/${ticketId}`, { column_name: columnName });
        await refreshKanban();
      } finally {
        setBusy(false);
      }
    },
    [refreshKanban],
  );

  const removeTicket = useCallback(
    async (ticketId: string) => {
      setBusy(true);
      try {
        await apiDelete(`/api/v1/personal/kanban/cards/${ticketId}`);
        await refreshKanban();
      } finally {
        setBusy(false);
      }
    },
    [refreshKanban],
  );

  return (
    <section className="wire-card mb-0 flex flex-col gap-4">
      <div>
        <h2 className="wire-sec-title text-base">Mit kanban</h2>
        <p className="text-muted-foreground text-sm">
          Træk dine sager mellem kolonner — kun synligt for dig.
        </p>
      </div>

      {availableTickets.length > 0 ? (
        <div className="rounded-lg border border-dashed p-3">
          <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
            Tilføj sag til board
          </p>
          <ul className="flex flex-wrap gap-2">
            {availableTickets.slice(0, 8).map((ticket) => (
              <li key={ticket.id}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void addTicket(ticket.id, kanban.columns[0] ?? "Min kø")}
                >
                  {ticket.ticket_number}: {ticket.title.slice(0, 40)}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        {kanban.columns.map((column) => (
          <div
            key={column}
            className={cn(
              "bg-muted/30 flex min-h-[220px] flex-col rounded-lg border p-3",
              dragTicketId && "ring-star-blue/30 ring-2",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const ticketId = e.dataTransfer.getData(DRAG_MIME);
              setDragTicketId(null);
              if (ticketId) void moveTicket(ticketId, column);
            }}
          >
            <h3 className="mb-3 text-sm font-semibold">{column}</h3>
            <ul className="flex flex-1 flex-col gap-2">
              {(cardsByColumn.get(column) ?? []).map((card) => {
                const ticket = ticketById(kanban.tickets, card.ticket_id);
                if (!ticket) return null;
                return (
                  <li
                    key={card.ticket_id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_MIME, card.ticket_id);
                      setDragTicketId(card.ticket_id);
                    }}
                    onDragEnd={() => setDragTicketId(null)}
                    className="bg-card cursor-grab rounded-md border p-3 shadow-sm active:cursor-grabbing"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="text-star-blue text-sm font-medium hover:underline"
                      >
                        {ticket.ticket_number}
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        aria-label="Fjern fra board"
                        onClick={() => void removeTicket(card.ticket_id)}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    </div>
                    <p className="mb-2 line-clamp-2 text-sm">{ticket.title}</p>
                    <div className="flex flex-wrap gap-1">
                      <WireStatusBadge status={ticket.status} />
                      <WirePriorityBadge priority={ticket.priority} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MyTicketsSection({ userTickets }: { userTickets: UserTicketsGrouped }) {
  const assigned = userTickets.assigned;
  const reported = userTickets.reported;

  return (
    <section className="wire-card mb-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="wire-sec-title text-base">Mine sager</h2>
          <p className="text-muted-foreground text-sm">Tildelte og indmeldte sager.</p>
        </div>
        <Link
          href="/tickets/new"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
        >
          <ExternalLink className="size-4" aria-hidden />
          Ny sag
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TicketGroup title="Tildelt mig" tickets={assigned} empty="Ingen tildelte sager." />
        <TicketGroup title="Indmeldt af mig" tickets={reported} empty="Du har ikke oprettet sager endnu." />
      </div>
    </section>
  );
}

function TicketGroup({
  title,
  tickets,
  empty,
}: {
  title: string;
  tickets: Ticket[];
  empty: string;
}) {
  if (tickets.length === 0) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{empty}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">
        {title} ({tickets.length})
      </h3>
      <ul className="divide-border divide-y rounded-lg border">
        {tickets.slice(0, 10).map((ticket) => (
          <li key={ticket.id} className="hover:bg-muted/40 px-3 py-2">
            <Link href={`/tickets/${ticket.id}`} className="block">
              <span className="text-star-blue text-xs font-medium">{ticket.ticket_number}</span>
              <p className="line-clamp-1 text-sm">{ticket.title}</p>
              <div className="mt-1 flex gap-1">
                <WireStatusBadge status={ticket.status} />
                <WirePriorityBadge priority={ticket.priority} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {tickets.length > 10 ? (
        <Link href="/tickets" className="text-star-blue mt-2 inline-block text-sm underline">
          Se alle sager
        </Link>
      ) : null}
    </div>
  );
}
