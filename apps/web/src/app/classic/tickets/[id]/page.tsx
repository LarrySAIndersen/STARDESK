import Link from "next/link";
import { notFound } from "next/navigation";

import { ClassicShellWrapper } from "@/components/classic/classic-shell-wrapper";
import { ClassicTicketTabSync } from "@/components/classic/classic-ticket-tab-sync";
import { ClassicUiSwitcher } from "@/components/classic/classic-ui-switcher";
import { getServerUser } from "@/lib/auth-server";
import { apiGetServer } from "@/lib/api-server";
import { isClassicOnlyUser } from "@/lib/classic-ui-mode";
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

  const currentUser = await getServerUser();
  const classicOnly = isClassicOnlyUser(currentUser?.ui_mode);

  return (
    <ClassicShellWrapper title={ticket.ticket_number}>
      <ClassicTicketTabSync
        ticketId={ticket.id}
        ticketNumber={ticket.ticket_number}
        title={ticket.title}
        reporterDisplayName={ticket.reporter_display_name}
        assignedUserName={ticket.assigned_user_name}
      />
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

        {!classicOnly ? (
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
        ) : null}
      </div>
    </ClassicShellWrapper>
  );
}
