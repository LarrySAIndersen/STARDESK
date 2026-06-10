"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import Link from "next/link";
import { useCallback, useId, useMemo, useState } from "react";
import { ExternalLink, Pin, Plus, X } from "lucide-react";

import { WirePriorityBadge, WireStatusBadge } from "@/components/wireframe/wire-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AccessibleModalBackdrop,
  AccessibleModalPanel,
} from "@/components/ui/accessible-modal-shell";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { TicketPostItDropTarget } from "@/components/personal/post-it-attach-provider";
import { PERSONAL_KANBAN_DRAG_MIME } from "@/lib/personal-board-dnd";
import { cn } from "@/lib/utils";
import { PERSONAL_KANBAN_COLUMNS, type PersonalKanban } from "@/types/personal";

const PINNED_QUEUE_COLUMN = PERSONAL_KANBAN_COLUMNS[0];
import type { Ticket } from "@/types/ticket";
import type { UserTicketsGrouped } from "@/types/admin-user";

function ticketById(tickets: Ticket[], id: string): Ticket | undefined {
  return tickets.find((t) => t.id === id);
}

export function PersonalKanbanBoard({
  kanban,
  assignableTickets,
  hiddenColumns = [],
  onKanbanChange,
}: {
  kanban: PersonalKanban;
  assignableTickets: Ticket[];
  hiddenColumns?: string[];
  onKanbanChange?: (kanban: PersonalKanban) => void;
}) {
  const [dragTicketId, setDragTicketId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogColumn, setCreateDialogColumn] = useState<string | null>(null);

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
    onKanbanChange?.(data);
  }, [onKanbanChange]);

  const visibleColumns = useMemo(
    () => kanban.columns.filter((col) => !hiddenColumns.includes(col)),
    [hiddenColumns, kanban.columns],
  );

  const placeTicketInColumn = useCallback(
    async (ticketId: string, columnName: string) => {
      setBusy(true);
      try {
        if (boardTicketIds.has(ticketId)) {
          await apiPatch(`/api/v1/personal/kanban/cards/${ticketId}`, { column_name: columnName });
        } else {
          await apiPost("/api/v1/personal/kanban/cards", {
            ticket_id: ticketId,
            column_name: columnName,
          });
        }
        await refreshKanban();
      } finally {
        setBusy(false);
      }
    },
    [boardTicketIds, refreshKanban],
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
          Træk sager mellem kolonner — eller op på <strong>opslagstavlen</strong> (fastgjorte
          sager).
        </p>
      </div>

      {availableTickets.length > 0 ? (
        <div className="rounded-lg border border-dashed p-3">
          <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
            Tilføj sag til board
          </p>
          <ul className="flex flex-wrap gap-2">
            {availableTickets.slice(0, 8).map((ticket, index) => (
              <li key={ticket.id}>
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(PERSONAL_KANBAN_DRAG_MIME, ticket.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className={cn(
                    "bulletin-ticket-chip group cursor-grab active:cursor-grabbing",
                    index % 2 === 0 ? "-rotate-1" : "rotate-1",
                  )}
                >
                  <span className="bulletin-pushpin bulletin-pushpin--chip" aria-hidden />
                  <span className="bulletin-ticket-chip__number">{ticket.ticket_number}</span>
                  <span className="bulletin-ticket-chip__title">{ticket.title.slice(0, 36)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="bulletin-ticket-chip__add h-6 px-2 text-[10px]"
                    disabled={busy}
                    onClick={() => fireAndForget(placeTicketInColumn(ticket.id, PINNED_QUEUE_COLUMN))}
                  >
                    Fastgør
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-3",
          visibleColumns.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2",
        )}
      >
        {visibleColumns.map((column) => (
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
              const ticketId = e.dataTransfer.getData(PERSONAL_KANBAN_DRAG_MIME);
              setDragTicketId(null);
              if (ticketId) fireAndForget(placeTicketInColumn(ticketId, column));
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{column}</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Opret sag i ${column}`}
                onClick={() => {
                  setCreateDialogColumn(column);
                  setCreateDialogOpen(true);
                }}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
            </div>
            <ul className="flex flex-1 flex-col gap-2">
              {(cardsByColumn.get(column) ?? []).map((card) => {
                const ticket = ticketById(kanban.tickets, card.ticket_id);
                if (!ticket) return null;
                return (
                  <li
                    key={card.ticket_id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(PERSONAL_KANBAN_DRAG_MIME, card.ticket_id);
                      setDragTicketId(card.ticket_id);
                    }}
                    onDragEnd={() => setDragTicketId(null)}
                    className="bulletin-kanban-card group cursor-grab rounded-md border p-3 pt-4 shadow-sm active:cursor-grabbing"
                  >
                    <TicketPostItDropTarget
                      ticketId={ticket.id}
                      ticketNumber={ticket.ticket_number}
                      ticketTitle={ticket.title}
                      className="block"
                    >
                    <span className="bulletin-pushpin bulletin-pushpin--card" aria-hidden />
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="text-star-blue text-sm font-medium hover:underline"
                      >
                        {ticket.ticket_number}
                      </Link>
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label="Fastgør på opslagstavle"
                          title="Fastgør på opslagstavle"
                          onClick={() => fireAndForget(placeTicketInColumn(card.ticket_id, PINNED_QUEUE_COLUMN))}
                        >
                          <Pin className="size-3.5" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label="Fjern fra board"
                          onClick={() => fireAndForget(removeTicket(card.ticket_id))}
                        >
                          <X className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                    <p className="mb-2 line-clamp-2 text-sm">{ticket.title}</p>
                    <div className="flex flex-wrap gap-1">
                      <WireStatusBadge status={ticket.status} />
                      <WirePriorityBadge priority={ticket.priority} />
                    </div>
                    </TicketPostItDropTarget>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <PersonalKanbanCreateDialog
        open={createDialogOpen}
        columnName={createDialogColumn}
        onClose={() => {
          setCreateDialogOpen(false);
          setCreateDialogColumn(null);
        }}
        onCreated={() => {
          fireAndForget(refreshKanban());
        }}
      />
    </section>
  );
}

export function MyTicketsSection({
  userTickets,
  boardTicketIds = new Set<string>(),
}: {
  userTickets: UserTicketsGrouped;
  boardTicketIds?: Set<string>;
}) {
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
        <TicketGroup
          title="Tildelt mig"
          tickets={assigned}
          empty="Ingen tildelte sager."
          boardTicketIds={boardTicketIds}
        />
        <TicketGroup
          title="Indmeldt af mig"
          tickets={reported}
          empty="Du har ikke oprettet sager endnu."
          boardTicketIds={boardTicketIds}
        />
      </div>
    </section>
  );
}

function TicketGroup({
  title,
  tickets,
  empty,
  boardTicketIds,
}: {
  title: string;
  tickets: Ticket[];
  empty: string;
  boardTicketIds: Set<string>;
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
        {tickets.slice(0, 10).map((ticket, index) => {
          const onBoard = boardTicketIds.has(ticket.id);
          return (
            <li
              key={ticket.id}
              draggable={!onBoard}
              onDragStart={(e) => {
                if (onBoard) return;
                e.dataTransfer.setData(PERSONAL_KANBAN_DRAG_MIME, ticket.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              className={cn(
                "bulletin-ticket-row group relative px-3 py-2.5 pt-3",
                !onBoard && "cursor-grab active:cursor-grabbing hover:bg-muted/40",
                onBoard && "opacity-70",
              )}
            >
              <span
                className={cn(
                  "bulletin-pushpin bulletin-pushpin--row",
                  index % 2 === 0 ? "-rotate-[38deg]" : "-rotate-[42deg]",
                )}
                aria-hidden
              />
              <TicketPostItDropTarget
                ticketId={ticket.id}
                ticketNumber={ticket.ticket_number}
                ticketTitle={ticket.title}
                className="block"
              >
              <Link href={`/tickets/${ticket.id}`} className="block pl-1">
                <span className="text-star-blue text-xs font-medium">{ticket.ticket_number}</span>
                <p className="line-clamp-1 text-sm">{ticket.title}</p>
                <div className="mt-1 flex gap-1">
                  <WireStatusBadge status={ticket.status} />
                  <WirePriorityBadge priority={ticket.priority} />
                </div>
              </Link>
              </TicketPostItDropTarget>
            </li>
          );
        })}
      </ul>
      {tickets.length > 10 ? (
        <Link href="/tickets" className="text-star-blue mt-2 inline-block text-sm underline">
          Se alle sager
        </Link>
      ) : null}
    </div>
  );
}

function PersonalKanbanCreateDialog({
  open,
  columnName,
  onClose,
  onCreated,
}: {
  open: boolean;
  columnName: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const trapRef = useFocusTrap(open);

  if (!open || !columnName) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    if (trimmedTitle.length < 3) {
      setError("Titel skal være mindst 3 tegn.");
      return;
    }
    if (trimmedDesc.length < 10) {
      setError("Beskrivelse skal være mindst 10 tegn.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const createdTicket = await apiPost<Ticket>("/api/v1/tickets", {
        title: trimmedTitle,
        description: trimmedDesc,
        ticket_type: "incident",
        priority: "medium",
      });
      await apiPost("/api/v1/personal/kanban/cards", {
        ticket_id: createdTicket.id,
        column_name: columnName,
      });
      setTitle("");
      setDescription("");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette sag.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccessibleModalBackdrop onClose={onClose}>
      <AccessibleModalPanel
        trapRef={trapRef}
        titleId={titleId}
        onClose={onClose}
        className="bg-card w-full max-w-md space-y-4 rounded-lg border p-5 shadow-lg"
      >
        <form onSubmit={handleSubmit} autoComplete="off">
          <h2 id={titleId} className="text-lg font-semibold">
            Opret ny sag i {columnName}
          </h2>
          <div className="mt-4 space-y-2">
            <Label htmlFor="pk-quick-title">Titel</Label>
            <Input
              id="pk-quick-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kort beskrivelse af problemet (mindst 3 tegn)"
              autoFocus
              autoComplete="off"
            />
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="pk-quick-desc">Beskrivelse</Label>
            <Textarea
              id="pk-quick-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Uddyb hvad der skal løses (mindst 10 tegn)"
              autoComplete="off"
            />
          </div>
          {error ? <p className="text-destructive mt-3 text-sm">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Annuller
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Opretter…" : "Opret sag"}
            </Button>
          </div>
        </form>
      </AccessibleModalPanel>
    </AccessibleModalBackdrop>
  );
}
