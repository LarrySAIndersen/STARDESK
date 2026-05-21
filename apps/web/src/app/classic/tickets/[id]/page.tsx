import Link from "next/link";
import { notFound } from "next/navigation";

import { ClassicShellWrapper } from "@/components/classic/classic-shell-wrapper";
import { ClassicUiSwitcher } from "@/components/classic/classic-ui-switcher";
import { apiGetServer } from "@/lib/api-server";
import { statusLabel, priorityLabel, ticketTypeLabel } from "@/lib/ticket-labels";
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
      <div className="classic-page">
        <header className="classic-page__header">
          <h2 className="classic-page__title">
            {ticket.ticket_number} — {ticket.title}
          </h2>
          <p className="classic-page__meta">
            {ticketTypeLabel(ticket.ticket_type)} · {statusLabel(ticket.status)} ·{" "}
            {priorityLabel(ticket.priority)}
          </p>
        </header>

        <dl className="classic-detail-grid">
          <div>
            <dt>Gruppe</dt>
            <dd>{ticket.assigned_team_name ?? "—"}</dd>
          </div>
          <div>
            <dt>Behandler</dt>
            <dd>{ticket.assigned_user_name ?? "—"}</dd>
          </div>
          <div>
            <dt>Beskrivelse</dt>
            <dd className="classic-detail-grid__block">{ticket.description || "—"}</dd>
          </div>
        </dl>

        <div className="classic-detail-actions">
          <Link href={`/tickets/${ticket.id}`} className="classic-btn">
            Fuld sag i moderne visning
          </Link>
          <ClassicUiSwitcher
            targetMode="modern"
            label="Skift til moderne UI"
            className="classic-btn classic-btn--secondary"
          />
        </div>
      </div>
    </ClassicShellWrapper>
  );
}
