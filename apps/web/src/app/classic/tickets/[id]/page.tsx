import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

import { ClassicShellWrapper } from "@/components/classic/classic-shell-wrapper";
import { ClassicUiSwitcher } from "@/components/classic/classic-ui-switcher";
import { TicketCaseLayout } from "@/components/ticket/ticket-case-layout";
import { apiGetServer } from "@/lib/api-server";
import type { TicketDetail } from "@/types/ticket";

export const dynamic = "force-dynamic";

export default async function ClassicTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let ticket: TicketDetail | null = null;
  try {
    ticket = await apiGetServer<TicketDetail>(`/api/v1/tickets/${id}`);
  } catch {
    ticket = null;
  }

  if (!ticket) {
    notFound();
  }

  return (
    <ClassicShellWrapper title={ticket.ticket_number}>
      <TicketCaseLayout
        ticket={ticket}
        staffView
        breadcrumb={
          <nav className="portal-v2-breadcrumb text-[12px]" aria-label="Brødkrumme">
            <Link href="/classic/incidents" className="portal-v2-breadcrumb-link">
              Incidents
            </Link>
            <ChevronRight className="size-3.5 opacity-50" aria-hidden />
            <span className="text-foreground font-medium">{ticket.ticket_number}</span>
          </nav>
        }
        below={
          <div className="flex flex-wrap gap-3">
            <Link href={`/tickets/${ticket.id}`} className="classic-btn">
              Fuld sag i moderne visning
            </Link>
            <ClassicUiSwitcher
              targetMode="modern"
              label="Skift til moderne UI"
              className="classic-btn classic-btn--secondary"
            />
          </div>
        }
      />
    </ClassicShellWrapper>
  );
}
