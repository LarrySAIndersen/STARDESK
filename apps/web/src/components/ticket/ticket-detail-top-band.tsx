import type { ReactNode } from "react";
import { User } from "lucide-react";

import { SlaCountdown } from "@/components/sla-countdown";
import { TicketMetadataEditablePanel } from "@/components/ticket/ticket-metadata-editable-panel";
import { priorityLabel, ticketTypeLabel } from "@/lib/ticket-labels";
import { ticketSourceLabelDa } from "@/lib/ticket-source-label";
import type { Category } from "@/types/category";
import type { Team } from "@/types/team";
import type { TicketDetail } from "@/types/ticket";

function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[var(--gray-border)] py-1.5 text-xs last:border-b-0">
      <span className="text-[var(--gray-mid)] shrink-0 font-medium">{label}</span>
      <span className="text-star-navy text-right font-medium">{value}</span>
    </div>
  );
}

function reporterInitials(name: string | null | undefined): string {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

export function TicketDetailTopBand({
  ticket,
  teams = [],
  categories = [],
  editableMetadata = false,
}: {
  ticket: TicketDetail;
  teams?: Team[];
  categories?: Category[];
  editableMetadata?: boolean;
}) {
  const reporter = ticket.reporter_display_name ?? "Ukendt indmelder";
  const canEdit = editableMetadata && teams.length > 0 && categories.length > 0;

  return (
    <div className="ticket-detail-top-band mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <section className="wire-card mb-0">
        <h2 className="wire-card-title">Indmelder</h2>
        <div className="flex items-start gap-3">
          <div
            className="bg-star-navy flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            aria-hidden
          >
            {reporterInitials(reporter)}
          </div>
          <div className="min-w-0">
            <p className="text-star-navy text-base font-semibold">{reporter}</p>
            <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
              <User className="size-3.5 shrink-0" aria-hidden />
              Bruger der oprettede sagen
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              Oprettet {formatDate(ticket.created_at)}
              {ticket.updated_at ? ` · Opdateret ${formatDate(ticket.updated_at)}` : ""}
            </p>
          </div>
        </div>
      </section>

      <section className="wire-card mb-0 lg:text-right">
        <h2 className="wire-card-title">Metadata</h2>
        <dl>
          {canEdit ? (
            <TicketMetadataEditablePanel
              ticket={ticket}
              teams={teams}
              categories={categories}
            />
          ) : (
            <>
              <DetailRow label="Kategori" value={ticket.category_name_da ?? "—"} />
              <DetailRow label="Underkategori" value={ticket.subcategory_name_da ?? "—"} />
              <DetailRow label="Prioritet" value={priorityLabel(ticket.priority)} />
              <DetailRow label="Type" value={ticketTypeLabel(ticket.ticket_type)} />
              <DetailRow
                label="Kilde"
                value={ticket.source_label_da ?? ticketSourceLabelDa(ticket.source)}
              />
              <DetailRow label="Gruppe" value={ticket.assigned_team_name ?? "—"} />
              <DetailRow label="Sagsbehandler" value={ticket.assigned_user_name ?? "—"} />
              <DetailRow
                label="SLA"
                value={
                  <SlaCountdown
                    status={ticket.status}
                    resolutionDueAt={ticket.resolution_due_at}
                    slaRemainingSeconds={ticket.sla_remaining_seconds}
                    slaBreached={ticket.sla_breached}
                    compact
                  />
                }
              />
            </>
          )}
        </dl>
      </section>
    </div>
  );
}
