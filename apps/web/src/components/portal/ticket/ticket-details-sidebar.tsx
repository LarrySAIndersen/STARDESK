import type { ReactNode } from "react";

import { SlaCountdown } from "@/components/sla-countdown";
import { priorityLabel } from "@/lib/ticket-labels";
import type { TicketDetail } from "@/types/ticket";

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[var(--gray-border)] py-2.5 text-[13px] last:border-b-0">
      <span className="text-[var(--gray-mid)] shrink-0 font-medium">{label}</span>
      <span className="text-star-navy text-right font-medium">{value}</span>
    </div>
  );
}

export function TicketDetailsSidebar({ ticket }: { ticket: TicketDetail }) {
  return (
    <aside className="portal-v2-card p-4" aria-labelledby="ticket-details-heading">
      <h2 id="ticket-details-heading" className="portal-v2-section-title mb-3">
        Detaljer
      </h2>
      <dl className="space-y-0">
        <DetailRow label="Kategori" value={ticket.category_name_da ?? "—"} />
        <DetailRow
          label="Underkategori"
          value={ticket.subcategory_name_da ?? "—"}
        />
        <DetailRow
          label="Tildelt team"
          value={ticket.assigned_team_name ?? "Ikke tildelt endnu"}
        />
        <DetailRow
          label="Sagsbehandler"
          value={ticket.assigned_user_name ?? "—"}
        />
        <DetailRow label="Prioritet" value={priorityLabel(ticket.priority)} />
        <DetailRow
          label="Indmelder"
          value={ticket.reporter_display_name ?? "—"}
        />
      </dl>
      <div className="border-[var(--gray-border)] mt-4 border-t pt-4">
        <p className="text-[var(--gray-mid)] mb-2 text-[12px] font-medium uppercase tracking-wide">
          SLA
        </p>
        <SlaCountdown
          status={ticket.status}
          resolutionDueAt={ticket.resolution_due_at}
          slaRemainingSeconds={ticket.sla_remaining_seconds}
          slaBreached={ticket.sla_breached}
        />
      </div>
    </aside>
  );
}
