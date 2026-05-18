import Link from "next/link";

import { apiGetServer } from "@/lib/api-server";
import type { Ticket } from "@/types/ticket";
import type { User } from "@/types/user";

const PORTAL_CATEGORIES = [
  { title: "IT-support", sub: "Computer, software, adgang" },
  { title: "HR & personale", sub: "Onboarding, adgang, politikker" },
  { title: "Faciliteter", sub: "Lokaler, udstyr, print" },
] as const;

type EndUserTicketPortalProps = {
  currentUser: User | null;
};

export async function EndUserTicketPortal({ currentUser }: EndUserTicketPortalProps) {
  let tickets: Ticket[] = [];
  let fetchError: string | null = null;

  try {
    tickets = await apiGetServer<Ticket[]>("/api/v1/tickets");
  } catch {
    fetchError = "Kunne ikke hente sager fra API. Tjek at backend kører.";
  }

  const regularTickets = tickets.filter((ticket) => !ticket.is_major);
  const ownOrgOnly = regularTickets.filter((ticket) => !ticket.is_shared);

  return (
    <div className="space-y-6">
      <section className="wire-portal-hero">
        <h2 className="text-xl font-bold tracking-tight">
          Hej{currentUser?.display_name ? `, ${currentUser.display_name.split(" ")[0]}` : ""} — hvordan kan vi hjælpe?
        </h2>
        <p className="mt-1 text-[13px] text-white/75">
          Søg i videnbasen eller opret en ny sag til STAR Service Desk.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/portal/knowledge"
            className="wire-btn border-2 border-white/40 bg-white/15 text-white hover:bg-white/25"
          >
            Søg vidensbase
          </Link>
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-3">
        {PORTAL_CATEGORIES.map((cat) => (
          <Link key={cat.title} href="/tickets/new" className="wire-portal-card block">
            <p className="text-star-navy text-[13px] font-bold">{cat.title}</p>
            <p className="text-[var(--gray-mid)] mt-0.5 text-[11px]">{cat.sub}</p>
          </Link>
        ))}
      </div>

      <section>
        <h3 className="wire-sec-title mb-3">Mine sager</h3>
        {fetchError ? (
          <p className="text-star-red text-sm">{fetchError}</p>
        ) : ownOrgOnly.length === 0 ? (
          <p className="text-[var(--gray-mid)] text-sm">Ingen sager endnu.</p>
        ) : (
          <div className="wire-table-wrap">
            {ownOrgOnly.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="my-ticket-row flex items-center gap-2 border-b border-[var(--gray-border)] px-3.5 py-2.5 text-xs last:border-b-0 hover:bg-star-blue-light"
              >
                <span className="font-mono font-semibold text-[var(--gray-mid)]">
                  {ticket.ticket_number}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{ticket.title}</span>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Link href="/tickets/new" className="wire-btn wire-btn-red">
            + Opret ny sag
          </Link>
        </div>
      </section>
    </div>
  );
}
