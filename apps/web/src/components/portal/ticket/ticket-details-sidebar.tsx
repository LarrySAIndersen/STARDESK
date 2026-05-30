"use client";

import type { ReactNode } from "react";

import { PageLayoutField, PageLayoutGrid } from "@/components/page-layout/page-layout-field";
import {
  pageLayoutSagaActiveClass,
} from "@/components/page-layout/page-layout-edit-saga-indicator";
import { usePageLayoutEdit } from "@/components/page-layout/page-layout-edit-provider";
import { SlaCountdown } from "@/components/sla-countdown";
import { priorityLabel } from "@/lib/ticket-labels";
import { ticketSourceLabelDa } from "@/lib/ticket-source-label";
import type { TicketDetail } from "@/types/ticket";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-2.5 text-[13px] last:border-b-0">
      <span className="text-muted-foreground shrink-0 font-medium">{label}</span>
      <span className="text-foreground text-right font-medium">{value}</span>
    </div>
  );
}

export function TicketDetailsSidebar({ ticket }: { ticket: TicketDetail }) {
  const { getField, canEdit, editMode } = usePageLayoutEdit();

  return (
    <aside
      className={pageLayoutSagaActiveClass(canEdit, editMode, "portal-v2-card p-4")}
      aria-labelledby="ticket-details-heading"
    >
      <h2 id="ticket-details-heading" className="portal-v2-section-title mb-3">
        Detaljer
      </h2>
      <PageLayoutGrid className="dl space-y-0">
        <PageLayoutField fieldId="category" defaultLabel="Kategori" defaultOrder={10}>
          <DetailRow
            label={getField("category", { label: "Kategori", order: 10 }).label}
            value={ticket.category_name_da ?? "—"}
          />
        </PageLayoutField>
        <PageLayoutField fieldId="subcategory" defaultLabel="Underkategori" defaultOrder={20}>
          <DetailRow
            label={getField("subcategory", { label: "Underkategori", order: 20 }).label}
            value={ticket.subcategory_name_da ?? "—"}
          />
        </PageLayoutField>
        <PageLayoutField fieldId="team" defaultLabel="Tildelt team" defaultOrder={30}>
          <DetailRow
            label={getField("team", { label: "Tildelt team", order: 30 }).label}
            value={ticket.assigned_team_name ?? "Ikke tildelt endnu"}
          />
        </PageLayoutField>
        <PageLayoutField fieldId="assignee" defaultLabel="Sagsbehandler" defaultOrder={40}>
          <DetailRow
            label={getField("assignee", { label: "Sagsbehandler", order: 40 }).label}
            value={ticket.assigned_user_name ?? "—"}
          />
        </PageLayoutField>
        <PageLayoutField fieldId="priority" defaultLabel="Prioritet" defaultOrder={50}>
          <DetailRow
            label={getField("priority", { label: "Prioritet", order: 50 }).label}
            value={priorityLabel(ticket.priority)}
          />
        </PageLayoutField>
        <PageLayoutField fieldId="source" defaultLabel="Kilde" defaultOrder={60}>
          <DetailRow
            label={getField("source", { label: "Kilde", order: 60 }).label}
            value={ticket.source_label_da ?? ticketSourceLabelDa(ticket.source)}
          />
        </PageLayoutField>
        <PageLayoutField fieldId="reporter" defaultLabel="Indmelder" defaultOrder={70}>
          <DetailRow
            label={getField("reporter", { label: "Indmelder", order: 70 }).label}
            value={ticket.reporter_display_name ?? "—"}
          />
        </PageLayoutField>
      </PageLayoutGrid>
      <PageLayoutField fieldId="sla" defaultLabel="SLA" defaultOrder={80}>
        <div className="border-border mt-4 border-t pt-4">
          <p className="text-muted-foreground mb-2 text-[12px] font-medium uppercase tracking-wide">
            {getField("sla", { label: "SLA", order: 80 }).label}
          </p>
          <SlaCountdown
            status={ticket.status}
            resolutionDueAt={ticket.resolution_due_at}
            slaRemainingSeconds={ticket.sla_remaining_seconds}
            slaBreached={ticket.sla_breached}
          />
        </div>
      </PageLayoutField>
    </aside>
  );
}
