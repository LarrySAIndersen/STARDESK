"use client";

import { SlaCountdown } from "@/components/sla-countdown";
import { priorityLabel, statusLabel } from "@/lib/ticket-labels";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/types/ticket";

export function KanbanCard({
  ticket,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  ticket: Ticket;
  dragging?: boolean;
  onOpen: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  return (
    <article
      className={cn(
        "group relative cursor-grab rounded-md border border-[var(--gray-border)] bg-card p-3 shadow-sm transition-shadow active:cursor-grabbing",
        dragging && "opacity-60 ring-2 ring-star-blue/40",
        "hover:border-star-blue/35 hover:shadow-md",
      )}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-stardesk-kanban-ticket", ticket.id);
        event.dataTransfer.setData("text/plain", ticket.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Åbn sag ${ticket.ticket_number}`}
    >
      <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        {ticket.ticket_number}
      </p>
      <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{ticket.title}</h3>
      <div className="text-muted-foreground mt-2 flex flex-wrap gap-1.5 text-[10px]">
        <span className="rounded bg-muted px-1.5 py-0.5">{priorityLabel(ticket.priority)}</span>
        {ticket.assigned_user_name ? (
          <span className="rounded bg-muted px-1.5 py-0.5 truncate max-w-[8rem]">
            {ticket.assigned_user_name}
          </span>
        ) : null}
      </div>

      <div
        className="pointer-events-none absolute left-full top-0 z-30 ml-2 hidden w-56 rounded-md border border-[var(--gray-border)] bg-popover p-3 text-xs shadow-lg group-hover:block"
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
    </article>
  );
}
