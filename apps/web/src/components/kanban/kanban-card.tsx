"use client";

import { Trash2, X } from "lucide-react";
import { useState } from "react";

import { SlaCountdown } from "@/components/sla-countdown";
import { Button } from "@/components/ui/button";
import { priorityLabel, statusLabel } from "@/lib/ticket-labels";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/types/ticket";

export function KanbanCard({
  ticket,
  dragging,
  canRemove,
  canDeleteTicket,
  onOpen,
  onRemoveFromBoard,
  onDeleteTicket,
  onDragStart,
  onDragEnd,
}: {
  ticket: Ticket;
  dragging?: boolean;
  canRemove?: boolean;
  canDeleteTicket?: boolean;
  onOpen: () => void;
  onRemoveFromBoard?: () => void;
  onDeleteTicket?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [didDrag, setDidDrag] = useState(false);

  return (
    <article
      className={cn(
        "group relative cursor-grab rounded-lg border border-[var(--gray-border)] bg-card p-3 shadow-sm transition-all active:cursor-grabbing",
        dragging && "scale-[1.02] opacity-70 shadow-lg ring-2 ring-star-blue/50",
        !dragging && "hover:-translate-y-0.5 hover:border-star-blue/35 hover:shadow-md",
      )}
      draggable
      onDragStart={(event) => {
        setDidDrag(true);
        event.dataTransfer.setData("application/x-stardesk-kanban-ticket", ticket.id);
        event.dataTransfer.setData("text/plain", ticket.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={() => {
        onDragEnd?.();
        window.setTimeout(() => setDidDrag(false), 0);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setConfirmDelete(false);
      }}
      onClick={() => {
        if (didDrag) {
          return;
        }
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!didDrag) {
            onOpen();
          }
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Åbn sag ${ticket.ticket_number}`}
    >
      {(canRemove || canDeleteTicket) && hovered ? (
        <div className="absolute right-1 top-1 z-10 flex gap-0.5">
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-foreground"
              aria-label="Fjern fra board"
              onClick={(event) => {
                event.stopPropagation();
                onRemoveFromBoard?.();
              }}
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
          {canDeleteTicket ? (
            confirmDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="size-6"
                aria-label="Bekræft sletning af sag"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteTicket?.();
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 text-destructive hover:text-destructive"
                aria-label="Slet sag"
                onClick={(event) => {
                  event.stopPropagation();
                  setConfirmDelete(true);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )
          ) : null}
        </div>
      ) : null}

      <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        {ticket.ticket_number}
      </p>
      <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{ticket.title}</h3>
      <div className="text-muted-foreground mt-2 flex flex-wrap gap-1.5 text-[10px]">
        <span className="rounded bg-muted px-1.5 py-0.5">{priorityLabel(ticket.priority)}</span>
        {ticket.resolution_due_at || ticket.sla_remaining_seconds != null ? (
          <span className="rounded bg-muted px-1.5 py-0.5">
            <SlaCountdown
              resolutionDueAt={ticket.resolution_due_at}
              slaRemainingSeconds={ticket.sla_remaining_seconds}
              status={ticket.status}
              slaBreached={ticket.sla_breached}
              compact
            />
          </span>
        ) : null}
        {ticket.assigned_user_name ? (
          <span className="max-w-[8rem] truncate rounded bg-muted px-1.5 py-0.5">
            {ticket.assigned_user_name}
          </span>
        ) : null}
      </div>

      {hovered ? (
        <div
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-md border border-[var(--gray-border)] bg-popover p-3 text-xs shadow-lg"
          role="tooltip"
        >
          <p className="font-semibold">{ticket.title}</p>
          <dl className="mt-2 space-y-1">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{statusLabel(ticket.status)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Prioritet</dt>
              <dd>{priorityLabel(ticket.priority)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">SLA</dt>
              <dd>
                <SlaCountdown
                  resolutionDueAt={ticket.resolution_due_at}
                  slaRemainingSeconds={ticket.sla_remaining_seconds}
                  status={ticket.status}
                  slaBreached={ticket.sla_breached}
                  compact
                />
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Tildelt</dt>
              <dd>{ticket.assigned_user_name ?? ticket.assigned_team_name ?? "—"}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </article>
  );
}
