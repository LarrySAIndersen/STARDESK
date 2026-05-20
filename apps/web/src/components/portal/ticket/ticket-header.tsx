import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { ticketStatusBarColor } from "@/components/portal/ticket/ticket-status-colors";
import { WireStatusBadge } from "@/components/wireframe/wire-badge";
import { formatDateTimeDa } from "@/lib/utils";
import type { TicketDetail } from "@/types/ticket";

function primaryAction(status: string): { label: string; href: string } {
  if (status === "resolved" || status === "closed" || status === "cancelled") {
    return { label: "Opret ny sag", href: "/tickets/new" };
  }
  return { label: "Skriv opdatering", href: "#portal-comment-form" };
}

export function TicketHeader({ ticket }: { ticket: TicketDetail }) {
  const action = primaryAction(ticket.status);
  const barColor = ticketStatusBarColor(ticket.status);

  return (
    <header className="portal-v2-section space-y-4">
      <nav className="portal-v2-breadcrumb text-[12px]" aria-label="Brødkrumme">
        <Link href="/portal" className="portal-v2-breadcrumb-link">
          Oversigt
        </Link>
        <ChevronRight className="size-3.5 opacity-50" aria-hidden />
        <span className="text-star-navy font-medium">Sag</span>
      </nav>

      <div
        className="portal-v2-card border-t-4 overflow-hidden"
        style={{ borderTopColor: barColor }}
      >
        <div className="space-y-3 p-4 sm:p-5">
          <p className="text-[var(--gray-mid)] font-mono text-[12px] font-semibold tracking-wide">
            {ticket.ticket_number}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-star-navy text-xl font-bold tracking-tight sm:text-2xl">
                {ticket.title}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <WireStatusBadge status={ticket.status} />
                <span className="text-[var(--gray-mid)] text-[12px]">
                  Oprettet {formatDateTimeDa(ticket.created_at)}
                </span>
                {ticket.updated_at ? (
                  <span className="text-[var(--gray-mid)] text-[12px]">
                    · Opdateret {formatDateTimeDa(ticket.updated_at)}
                  </span>
                ) : null}
              </div>
            </div>
            <Link
              href={action.href}
              className="bg-star-navy hover:bg-star-blue inline-flex h-9 shrink-0 items-center justify-center rounded-[2px] px-4 text-sm font-medium text-white"
            >
              {action.label}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
