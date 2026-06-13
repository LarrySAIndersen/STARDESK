"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { HomeLandingCollapsibleSection } from "@/components/home-landing/home-landing-collapsible-section";
import { fireAndForget } from "@/lib/fire-and-forget";import { apiGet } from "@/lib/api";
import { TICKET_WATCH_CHANGED_EVENT } from "@/hooks/use-ticket-watch";
import { WirePriorityBadge, WireStatusBadge } from "@/components/wireframe/wire-badge";
import type { Ticket } from "@/types/ticket";

type WatchedTicketsPayload = {
  ticket_ids: string[];
  tickets: Ticket[];
};

export function HomeLandingWatchedTickets({ userId }: Readonly<{ userId: string }>) {
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<WatchedTicketsPayload>("/api/v1/personal/ticket-watch/tickets");
      setTickets(data.tickets ?? []);
    } catch {
      setTickets([]);
    }
  }, []);

  useEffect(() => {
    fireAndForget(reload());
  }, [reload]);

  useEffect(() => {
    const onChanged = () => fireAndForget(reload());
    window.addEventListener(TICKET_WATCH_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(TICKET_WATCH_CHANGED_EVENT, onChanged);
  }, [reload]);

  if (tickets.length === 0) {
    return null;
  }

  return (
    <HomeLandingCollapsibleSection
      userId={userId}
      sectionId="watched-tickets"
      title="Overvågede sager"
      defaultOpen={true}
    >
      <div className="home-landing__watched-inner">
        <div className="home-landing__watched-header">
          <Link href="/tickets" className="home-landing__watched-link">
            Alle sager
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <ul className="home-landing__watched-list">
        {tickets.slice(0, 6).map((ticket) => (
          <li key={ticket.id}>
            <Link href={`/tickets/${ticket.id}`} className="home-landing__watched-item group">
              <span className="text-muted-foreground shrink-0 text-xs font-semibold">
                {ticket.ticket_number}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{ticket.title}</span>
              <WireStatusBadge status={ticket.status} />
              <WirePriorityBadge priority={ticket.priority} />
            </Link>
          </li>
        ))}
        </ul>
      </div>
    </HomeLandingCollapsibleSection>
  );
}
