"use client";

import Link from "next/link";

import { ticketDetailHref } from "@/lib/team-group-view";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/types/ticket";

/** Single clickable ticket row in group lists (opens card or navigates to detail). */
export function TeamGroupTicketRow({
  ticket,
  onOpen,
  href,
  size = "sm",
  className,
}: {
  ticket: Ticket;
  /** Inline sagens kort (e.g. agent panel Sagsindhold). */
  onOpen?: () => void;
  /** Full ticket page; used when onOpen is not set. */
  href?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const detailHref = href ?? ticketDetailHref(ticket.id);
  const rowClass = cn(
    "block w-full rounded-[2px] text-left transition-colors",
    "cursor-pointer hover:bg-star-blue-light/40",
    "focus-visible:ring-2 focus-visible:ring-star-navy/30 focus-visible:outline-none",
    size === "sm" ? "px-1 py-0.5 text-[10px]" : "px-1 py-1.5 text-[11px]",
    className,
  );
  const label = `Åbn sag ${ticket.ticket_number}`;
  const content = (
    <>
      <span className="text-star-navy font-mono font-semibold">{ticket.ticket_number}</span>
      <span
        className={cn(
          "text-muted-foreground font-normal",
          size === "sm" ? "ml-1" : "ml-2",
        )}
      >
        {ticket.title}
      </span>
    </>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        className={rowClass}
        onClick={onOpen}
        aria-label={label}
        title={`${ticket.ticket_number} ${ticket.title}`}
      >
        <span className="block truncate">{content}</span>
      </button>
    );
  }

  return (
    <Link
      href={detailHref}
      className={rowClass}
      draggable={false}
      aria-label={label}
      title={`${ticket.ticket_number} ${ticket.title}`}
    >
      <span className="block truncate">{content}</span>
    </Link>
  );
}
