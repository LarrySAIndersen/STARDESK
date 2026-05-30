"use client";

import type { ReactNode } from "react";

import {
  pageLayoutSagaActiveClass,
} from "@/components/page-layout/page-layout-edit-saga-indicator";
import { PageLayoutField, PageLayoutGrid } from "@/components/page-layout/page-layout-field";
import { usePageLayoutEdit } from "@/components/page-layout/page-layout-edit-provider";
import { TicketTagBadges } from "@/components/ticket-tag-badges";

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-2.5 text-[13px] last:border-b-0">
      <span className="text-muted-foreground shrink-0 font-medium">{label}</span>
      <span className="text-foreground text-right font-medium">{value}</span>
    </div>
  );
}

export type Saglayout2DetailsData = {
  category: string;
  subcategory: string;
  team: string;
  assignee: string;
  priority: string;
  reporter: string;
  slaLabel: string;
  slaDetail: string;
  tags: string[];
  emoji?: string | null;
};

export function Saglayout2EditableDetails({ data }: { data: Saglayout2DetailsData }) {
  const { getField, canEdit, editMode } = usePageLayoutEdit();

  return (
    <aside
      className={pageLayoutSagaActiveClass(
        canEdit,
        editMode,
        "portal-v2-card p-4 sm:p-5 lg:sticky lg:top-4",
      )}
      aria-labelledby="saglayout2-details-heading"
    >
      <h2 id="saglayout2-details-heading" className="portal-v2-section-title mb-3">
        Detaljer
      </h2>
      {canEdit && editMode ? (
        <p className="text-muted-foreground mb-3 text-[11px] leading-snug">
          Design-tilstand: omdøb, flyt eller skjul felter — inkl. Tags — via værktøjslinjen
          øverst.
        </p>
      ) : null}
      <PageLayoutGrid className="space-y-0">
        <PageLayoutField fieldId="category" defaultLabel="Kategori" defaultOrder={10}>
          <DetailRow
            label={getField("category", { label: "Kategori", order: 10 }).label}
            value={data.category}
          />
        </PageLayoutField>
        <PageLayoutField fieldId="subcategory" defaultLabel="Underkategori" defaultOrder={20}>
          <DetailRow
            label={getField("subcategory", { label: "Underkategori", order: 20 }).label}
            value={data.subcategory}
          />
        </PageLayoutField>
        <PageLayoutField fieldId="team" defaultLabel="Tildelt team" defaultOrder={30}>
          <DetailRow
            label={getField("team", { label: "Tildelt team", order: 30 }).label}
            value={data.team}
          />
        </PageLayoutField>
        <PageLayoutField fieldId="assignee" defaultLabel="Sagsbehandler" defaultOrder={40}>
          <DetailRow
            label={getField("assignee", { label: "Sagsbehandler", order: 40 }).label}
            value={data.assignee}
          />
        </PageLayoutField>
        <PageLayoutField fieldId="priority" defaultLabel="Prioritet" defaultOrder={50}>
          <DetailRow
            label={getField("priority", { label: "Prioritet", order: 50 }).label}
            value={data.priority}
          />
        </PageLayoutField>
        <PageLayoutField fieldId="reporter" defaultLabel="Indmelder" defaultOrder={60}>
          <DetailRow
            label={getField("reporter", { label: "Indmelder", order: 60 }).label}
            value={data.reporter}
          />
        </PageLayoutField>
        <PageLayoutField fieldId="tags" defaultLabel="Tags" defaultOrder={70}>
          <div className="border-b border-border py-2.5 last:border-b-0">
            <p className="text-muted-foreground mb-1.5 text-[13px] font-medium">
              {getField("tags", { label: "Tags", order: 70 }).label}
            </p>
            <TicketTagBadges tags={data.tags} emoji={data.emoji} maxTags={12} />
          </div>
        </PageLayoutField>
      </PageLayoutGrid>
      <PageLayoutField fieldId="sla" defaultLabel="SLA" defaultOrder={80}>
        <div className="border-destructive/40 bg-destructive/5 mt-3 rounded-[2px] border p-2.5">
          <p className="text-destructive text-[11px] font-bold">
            {getField("sla", { label: "SLA", order: 80 }).label}: {data.slaLabel}
          </p>
          <p className="text-destructive/90 text-[11px]">{data.slaDetail}</p>
        </div>
      </PageLayoutField>
    </aside>
  );
}
