import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { ticketStatusBarColor } from "@/components/portal/ticket/ticket-status-colors";
import { WireStatusBadge } from "@/components/wireframe/wire-badge";
import { ticketSourceLabelDa } from "@/lib/ticket-source-label";
import { formatDateTimeDa } from "@/lib/utils";
import type { TicketDetail } from "@/types/ticket";

function primaryAction(
  status: string,
  commentFormId: string,
): { label: string; href: string } {
  if (status === "resolved" || status === "closed" || status === "cancelled") {
    return { label: "Opret ny sag", href: "/tickets/new" };
  }
  return { label: "Skriv opdatering", href: `#${commentFormId}` };
}

export function TicketHeader({
  ticket,
  breadcrumb,
  commentFormId = "portal-comment-form",
}: {
  ticket: TicketDetail;
  breadcrumb?: ReactNode;
  commentFormId?: string;
}) {
  const action = primaryAction(ticket.status, commentFormId);
  const barColor = ticketStatusBarColor(ticket.status);

  return (
    <header className="portal-v2-section space-y-4">
      {breadcrumb ?? (
        <nav className="portal-v2-breadcrumb text-[12px]" aria-label="Brødkrumme">
          <Link href="/portal" className="portal-v2-breadcrumb-link">
            Oversigt
          </Link>
          <ChevronRight className="size-3.5 opacity-50" aria-hidden />
          <span className="text-foreground font-medium">Sag</span>
        </nav>
      )}

      <div
        className="portal-v2-card border-t-4 overflow-hidden"
        style={{ borderTopColor: barColor }}
      >
        <div className="space-y-3 p-4 sm:p-5">
          <p className="portal-v2-meta">{ticket.ticket_number}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                {ticket.title}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <WireStatusBadge status={ticket.status} />
                <span className="portal-v2-chip">
                  Kilde: {ticket.source_label_da ?? ticketSourceLabelDa(ticket.source)}
                </span>
                <span className="text-muted-foreground text-[12px]">
                  Oprettet {formatDateTimeDa(ticket.created_at)}
                </span>
                {ticket.updated_at ? (
                  <span className="text-muted-foreground text-[12px]">
                    · Opdateret {formatDateTimeDa(ticket.updated_at)}
                  </span>
                ) : null}
              </div>
            </div>
            <Link href={action.href} className="portal-v2-btn-primary">
              {action.label}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
