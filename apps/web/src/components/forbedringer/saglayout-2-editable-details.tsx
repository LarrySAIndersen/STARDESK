"use client";

import { useMemo, useState, type ReactNode } from "react";

import {
  pageLayoutSagaActiveClass,
} from "@/components/page-layout/page-layout-edit-saga-indicator";
import { PageLayoutField, PageLayoutGrid } from "@/components/page-layout/page-layout-field";
import { usePageLayoutEdit } from "@/components/page-layout/page-layout-edit-provider";
import { TicketTagBadges } from "@/components/ticket-tag-badges";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { isUnassignedOption } from "@/lib/assignment-search";
import { filterStatusesForSearch } from "@/lib/metadata-search";
import { statusLabel } from "@/lib/ticket-labels";

function EditableRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1 border-b border-border py-2.5 text-[13px] last:border-b-0">
      <span className="text-muted-foreground block font-medium">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export type Saglayout2DetailsData = {
  status: string;
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

export function Saglayout2EditableDetails({
  data,
  onChange,
}: {
  data: Saglayout2DetailsData;
  onChange: (patch: Partial<Saglayout2DetailsData>) => void;
}) {
  const { getField, canEdit, editMode } = usePageLayoutEdit();
  const [statusQuery, setStatusQuery] = useState("");

  const statusOptions = useMemo(
    () => filterStatusesForSearch(statusQuery),
    [statusQuery],
  );

  function textField(
    key: keyof Pick<
      Saglayout2DetailsData,
      "category" | "subcategory" | "team" | "assignee" | "priority" | "reporter"
    >,
    value: string,
  ) {
    return (
      <Input
        value={value}
        onChange={(event) => onChange({ [key]: event.target.value })}
        className="h-8 text-[13px]"
        aria-label={key}
      />
    );
  }

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
          Design-tilstand: omdøb, flyt eller skjul felter via værktøjslinjen. Værdier i felterne
          kan redigeres som normalt.
        </p>
      ) : null}
      <PageLayoutGrid className="space-y-0">
        <PageLayoutField fieldId="status" defaultLabel="Status" defaultOrder={5}>
          <EditableRow
            label={getField("status", { label: "Status", order: 5 }).label}
          >
            <SearchableSelect
              valueId={data.status}
              displayValue={statusLabel(data.status)}
              options={statusOptions}
              placeholder="Søg status…"
              emptyLabel="—"
              allowClear={false}
              onQueryChange={setStatusQuery}
              onSelect={(option) => {
                if (!isUnassignedOption(option.id)) {
                  onChange({ status: option.id });
                }
              }}
            />
          </EditableRow>
        </PageLayoutField>
        <PageLayoutField fieldId="category" defaultLabel="Kategori" defaultOrder={10}>
          <EditableRow
            label={getField("category", { label: "Kategori", order: 10 }).label}
          >
            {textField("category", data.category)}
          </EditableRow>
        </PageLayoutField>
        <PageLayoutField fieldId="subcategory" defaultLabel="Underkategori" defaultOrder={20}>
          <EditableRow
            label={getField("subcategory", { label: "Underkategori", order: 20 }).label}
          >
            {textField("subcategory", data.subcategory)}
          </EditableRow>
        </PageLayoutField>
        <PageLayoutField fieldId="team" defaultLabel="Tildelt team" defaultOrder={30}>
          <EditableRow
            label={getField("team", { label: "Tildelt team", order: 30 }).label}
          >
            {textField("team", data.team)}
          </EditableRow>
        </PageLayoutField>
        <PageLayoutField fieldId="assignee" defaultLabel="Sagsbehandler" defaultOrder={40}>
          <EditableRow
            label={getField("assignee", { label: "Sagsbehandler", order: 40 }).label}
          >
            {textField("assignee", data.assignee)}
          </EditableRow>
        </PageLayoutField>
        <PageLayoutField fieldId="priority" defaultLabel="Prioritet" defaultOrder={50}>
          <EditableRow
            label={getField("priority", { label: "Prioritet", order: 50 }).label}
          >
            {textField("priority", data.priority)}
          </EditableRow>
        </PageLayoutField>
        <PageLayoutField fieldId="reporter" defaultLabel="Indmelder" defaultOrder={60}>
          <EditableRow
            label={getField("reporter", { label: "Indmelder", order: 60 }).label}
          >
            {textField("reporter", data.reporter)}
          </EditableRow>
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
