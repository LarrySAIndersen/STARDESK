"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  pageLayoutSagaActiveClass,
} from "@/components/page-layout/page-layout-edit-saga-indicator";
import { PageLayoutField, PageLayoutGrid } from "@/components/page-layout/page-layout-field";
import { usePageLayoutEdit } from "@/components/page-layout/page-layout-edit-provider";
import { SlaCountdown } from "@/components/sla-countdown";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  buildAssignablePeople,
  filterPeopleForSearch,
  filterTeamsForSearch,
  findPersonByUserId,
  isUnassignedOption,
  type SearchableOption,
} from "@/lib/assignment-search";
import {
  filterCategoriesForSearch,
  filterPrioritiesForSearch,
  filterSourcesForSearch,
  filterSubcategoriesForSearch,
} from "@/lib/metadata-search";
import { sortTeamsForDisplay } from "@/lib/team-categories";
import {
  saveTicketDetailDraft,
  ticketDetailDraftsEqual,
  ticketToDetailDraft,
  type TicketDetailDraft,
} from "@/lib/ticket-detail-draft-save";
import { priorityLabel } from "@/lib/ticket-labels";
import { ticketSourceLabelDa } from "@/lib/ticket-source-label";
import type { Category } from "@/types/category";
import type { Team } from "@/types/team";
import type { TicketDetail } from "@/types/ticket";

function EditableRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1 border-b border-border py-2.5 text-[13px] last:border-b-0">
      <span className="text-muted-foreground block font-medium">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-2.5 text-[13px] last:border-b-0">
      <span className="text-muted-foreground shrink-0 font-medium">{label}</span>
      <span className="text-foreground text-right font-medium">{value}</span>
    </div>
  );
}

export function TicketDetailsEditableSidebar({
  ticket: initialTicket,
  teams,
  categories,
  onTicketUpdated,
}: {
  ticket: TicketDetail;
  teams: Team[];
  categories: Category[];
  onTicketUpdated?: (ticket: TicketDetail) => void;
}) {
  const router = useRouter();
  const { getField, canEdit, editMode } = usePageLayoutEdit();
  const [ticket, setTicket] = useState(initialTicket);
  const [draft, setDraft] = useState<TicketDetailDraft>(() =>
    ticketToDetailDraft(initialTicket),
  );
  const [savedDraft, setSavedDraft] = useState<TicketDetailDraft>(() =>
    ticketToDetailDraft(initialTicket),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categoryQuery, setCategoryQuery] = useState("");
  const [subcategoryQuery, setSubcategoryQuery] = useState("");
  const [priorityQuery, setPriorityQuery] = useState("");
  const [sourceQuery, setSourceQuery] = useState("");
  const [teamQuery, setTeamQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");

  useEffect(() => {
    setTicket(initialTicket);
    const next = ticketToDetailDraft(initialTicket);
    setDraft(next);
    setSavedDraft(next);
  }, [initialTicket]);

  const sortedTeams = useMemo(
    () => sortTeamsForDisplay(teams.filter((team) => team.is_active)),
    [teams],
  );
  const deskPeople = useMemo(() => buildAssignablePeople(sortedTeams), [sortedTeams]);

  const activeSubcategories = useMemo(() => {
    if (!draft.category_id) {
      return [];
    }
    const category = categories.find((item) => item.id === draft.category_id);
    return category?.subcategories ?? [];
  }, [categories, draft.category_id]);

  const categoryOptions = useMemo(
    () => filterCategoriesForSearch(categories, categoryQuery),
    [categories, categoryQuery],
  );
  const subcategoryOptions = useMemo(
    () => filterSubcategoriesForSearch(activeSubcategories, subcategoryQuery),
    [activeSubcategories, subcategoryQuery],
  );
  const priorityOptions = useMemo(
    () => filterPrioritiesForSearch(priorityQuery),
    [priorityQuery],
  );
  const sourceOptions = useMemo(
    () => filterSourcesForSearch(sourceQuery),
    [sourceQuery],
  );
  const teamOptions = useMemo(
    () => filterTeamsForSearch(sortedTeams, teamQuery),
    [sortedTeams, teamQuery],
  );
  const userOptions = useMemo(
    () => filterPeopleForSearch(deskPeople, userQuery, draft.assigned_team_id),
    [deskPeople, userQuery, draft.assigned_team_id],
  );

  const hasChanges = !ticketDetailDraftsEqual(draft, savedDraft);

  const categoryLabel =
    categories.find((c) => c.id === draft.category_id)?.name_da ??
    ticket.category_name_da ??
    "—";
  const subcategoryLabel =
    activeSubcategories.find((s) => s.id === draft.subcategory_id)?.name_da ??
    ticket.subcategory_name_da ??
    "—";
  const teamLabel =
    sortedTeams.find((t) => t.id === draft.assigned_team_id)?.name ??
    ticket.assigned_team_name ??
    "Ikke tildelt endnu";
  const assigneeLabel =
    findPersonByUserId(deskPeople, draft.assigned_user_id)?.displayName ??
    ticket.assigned_user_name ??
    "—";

  function handleCategorySelect(option: SearchableOption) {
    const nextCategoryId = isUnassignedOption(option.id) ? null : option.id;
    setDraft((prev) => {
      const category = categories.find((c) => c.id === nextCategoryId);
      const subs = category?.subcategories ?? [];
      const keepSub =
        prev.subcategory_id && subs.some((s) => s.id === prev.subcategory_id);
      return {
        ...prev,
        category_id: nextCategoryId,
        subcategory_id: keepSub ? prev.subcategory_id : null,
      };
    });
  }

  function handleSubcategorySelect(option: SearchableOption) {
    if (!draft.category_id) {
      setError("Vælg kategori først.");
      return;
    }
    setError(null);
    setDraft((prev) => ({
      ...prev,
      subcategory_id: isUnassignedOption(option.id) ? null : option.id,
    }));
  }

  function handleTeamSelect(option: SearchableOption) {
    const nextTeamId = isUnassignedOption(option.id) ? null : option.id;
    setDraft((prev) => {
      let nextUserId = prev.assigned_user_id;
      if (nextTeamId === null) {
        nextUserId = null;
      } else if (nextUserId) {
        const person = findPersonByUserId(deskPeople, nextUserId);
        if (!person || person.teamId !== nextTeamId) {
          nextUserId = null;
        }
      }
      return {
        ...prev,
        assigned_team_id: nextTeamId,
        assigned_user_id: nextUserId,
      };
    });
  }

  function handleUserSelect(option: SearchableOption) {
    if (isUnassignedOption(option.id)) {
      setDraft((prev) => ({ ...prev, assigned_user_id: null }));
      return;
    }
    const person = findPersonByUserId(deskPeople, option.id);
    if (!person) {
      return;
    }
    setDraft((prev) => ({
      ...prev,
      assigned_team_id: prev.assigned_team_id ?? person.teamId,
      assigned_user_id: person.userId,
    }));
  }

  async function handleSave() {
    if (!hasChanges || isSaving) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const detail = await saveTicketDetailDraft(
        ticket.id,
        savedDraft,
        draft,
        ticket,
      );
      setTicket(detail);
      onTicketUpdated?.(detail);
      const nextSaved = ticketToDetailDraft(detail);
      setDraft(nextSaved);
      setSavedDraft(nextSaved);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme detaljer");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <aside
      className={pageLayoutSagaActiveClass(canEdit, editMode, "portal-v2-card p-4")}
      aria-labelledby="ticket-details-heading"
    >
      <h2 id="ticket-details-heading" className="portal-v2-section-title mb-3">
        Detaljer
      </h2>
      <PageLayoutGrid className="space-y-0">
        <PageLayoutField fieldId="category" defaultLabel="Kategori" defaultOrder={10}>
          <EditableRow
            label={getField("category", { label: "Kategori", order: 10 }).label}
          >
            <SearchableSelect
              valueId={draft.category_id}
              displayValue={categoryLabel}
              options={categoryOptions}
              placeholder="Søg kategori…"
              emptyLabel="Ingen kategori"
              disabled={isSaving}
              onQueryChange={setCategoryQuery}
              onSelect={handleCategorySelect}
            />
          </EditableRow>
        </PageLayoutField>
        <PageLayoutField fieldId="subcategory" defaultLabel="Underkategori" defaultOrder={20}>
          <EditableRow
            label={getField("subcategory", { label: "Underkategori", order: 20 }).label}
          >
            <SearchableSelect
              valueId={draft.subcategory_id}
              displayValue={subcategoryLabel}
              options={subcategoryOptions}
              placeholder={
                draft.category_id ? "Søg underkategori…" : "Vælg kategori først"
              }
              emptyLabel="Ingen underkategori"
              disabled={isSaving || !draft.category_id}
              onQueryChange={setSubcategoryQuery}
              onSelect={handleSubcategorySelect}
            />
          </EditableRow>
        </PageLayoutField>
        <PageLayoutField fieldId="team" defaultLabel="Tildelt team" defaultOrder={30}>
          <EditableRow
            label={getField("team", { label: "Tildelt team", order: 30 }).label}
          >
            <SearchableSelect
              valueId={draft.assigned_team_id}
              displayValue={teamLabel}
              options={teamOptions}
              placeholder="Søg gruppe…"
              emptyLabel="Ingen gruppe"
              disabled={isSaving}
              onQueryChange={setTeamQuery}
              onSelect={handleTeamSelect}
            />
          </EditableRow>
        </PageLayoutField>
        <PageLayoutField fieldId="assignee" defaultLabel="Sagsbehandler" defaultOrder={40}>
          <EditableRow
            label={getField("assignee", { label: "Sagsbehandler", order: 40 }).label}
          >
            <SearchableSelect
              valueId={draft.assigned_user_id}
              displayValue={assigneeLabel}
              options={userOptions}
              placeholder={
                draft.assigned_team_id ? "Søg i gruppen…" : "Søg navn eller gruppe…"
              }
              emptyLabel="Ikke tildelt person"
              disabled={isSaving}
              onQueryChange={setUserQuery}
              onSelect={handleUserSelect}
            />
          </EditableRow>
        </PageLayoutField>
        <PageLayoutField fieldId="priority" defaultLabel="Prioritet" defaultOrder={50}>
          <EditableRow
            label={getField("priority", { label: "Prioritet", order: 50 }).label}
          >
            <SearchableSelect
              valueId={draft.priority}
              displayValue={priorityLabel(draft.priority)}
              options={priorityOptions}
              placeholder="Søg prioritet…"
              emptyLabel="—"
              allowClear={false}
              disabled={isSaving}
              onQueryChange={setPriorityQuery}
              onSelect={(option) => {
                if (!isUnassignedOption(option.id)) {
                  setDraft((prev) => ({ ...prev, priority: option.id }));
                }
              }}
            />
          </EditableRow>
        </PageLayoutField>
        <PageLayoutField fieldId="source" defaultLabel="Kilde" defaultOrder={60}>
          <EditableRow label={getField("source", { label: "Kilde", order: 60 }).label}>
            <SearchableSelect
              valueId={draft.source}
              displayValue={ticketSourceLabelDa(draft.source)}
              options={sourceOptions}
              placeholder="Søg kilde…"
              emptyLabel="—"
              allowClear={false}
              disabled={isSaving}
              onQueryChange={setSourceQuery}
              onSelect={(option) => {
                if (!isUnassignedOption(option.id)) {
                  setDraft((prev) => ({ ...prev, source: option.id }));
                }
              }}
            />
          </EditableRow>
        </PageLayoutField>
        <PageLayoutField fieldId="reporter" defaultLabel="Indmelder" defaultOrder={70}>
          <ReadOnlyRow
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

      {error ? (
        <p className="text-destructive mt-3 text-[12px]" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        className="mt-4 w-full"
        disabled={!hasChanges || isSaving}
        onClick={() => void handleSave()}
      >
        {isSaving ? "Gemmer…" : "Gem"}
      </Button>
      {hasChanges && !isSaving ? (
        <p className="text-muted-foreground mt-2 text-center text-[11px]">
          Tildeling af team eller sagsbehandler kan flytte sagen til status Tildelt.
        </p>
      ) : null}
    </aside>
  );
}
