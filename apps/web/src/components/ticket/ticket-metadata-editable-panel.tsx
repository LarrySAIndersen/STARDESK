"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SlaCountdown } from "@/components/sla-countdown";
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
  filterStatusesForSearch,
  filterSourcesForSearch,
  filterSubcategoriesForSearch,
  filterTicketTypesForSearch,
  METADATA_FIELD_CHANGE_REASON,
} from "@/lib/metadata-search";
import { apiPatch } from "@/lib/api";
import { sortTeamsForDisplay } from "@/lib/team-categories";
import { priorityLabel, statusLabel, ticketTypeLabel } from "@/lib/ticket-labels";
import { ticketSourceLabelDa } from "@/lib/ticket-source-label";
import type { Category } from "@/types/category";
import type { Team } from "@/types/team";
import type { Ticket, TicketDetail } from "@/types/ticket";

function MetadataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--gray-border)] py-1.5 text-xs last:border-b-0">
      <span className="text-[var(--gray-mid)] shrink-0 pt-1.5 font-medium">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function TicketMetadataEditablePanel({
  ticket: initialTicket,
  teams,
  categories,
}: {
  ticket: TicketDetail;
  teams: Team[];
  categories: Category[];
}) {
  const router = useRouter();
  const [ticket, setTicket] = useState(initialTicket);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusQuery, setStatusQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [subcategoryQuery, setSubcategoryQuery] = useState("");
  const [priorityQuery, setPriorityQuery] = useState("");
  const [typeQuery, setTypeQuery] = useState("");
  const [sourceQuery, setSourceQuery] = useState("");
  const [teamQuery, setTeamQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");

  useEffect(() => {
    setTicket(initialTicket);
  }, [initialTicket]);

  const sortedTeams = useMemo(
    () => sortTeamsForDisplay(teams.filter((team) => team.is_active)),
    [teams],
  );
  const deskPeople = useMemo(() => buildAssignablePeople(sortedTeams), [sortedTeams]);

  const activeSubcategories = useMemo(() => {
    if (!ticket.category_id) {
      return [];
    }
    const category = categories.find((item) => item.id === ticket.category_id);
    return category?.subcategories ?? [];
  }, [categories, ticket.category_id]);

  const statusOptions = useMemo(
    () => filterStatusesForSearch(statusQuery),
    [statusQuery],
  );
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
  const typeOptions = useMemo(() => filterTicketTypesForSearch(typeQuery), [typeQuery]);
  const sourceOptions = useMemo(() => filterSourcesForSearch(sourceQuery), [sourceQuery]);
  const teamOptions = useMemo(
    () => filterTeamsForSearch(sortedTeams, teamQuery),
    [sortedTeams, teamQuery],
  );
  const userOptions = useMemo(
    () => filterPeopleForSearch(deskPeople, userQuery, ticket.assigned_team_id),
    [deskPeople, userQuery, ticket.assigned_team_id],
  );

  async function runSave(action: () => Promise<TicketDetail>) {
    setIsSaving(true);
    setError(null);
    try {
      const detail = await action();
      setTicket(detail);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusSelect(option: SearchableOption) {
    if (isUnassignedOption(option.id) || option.id === ticket.status) {
      return;
    }
    await runSave(async () => {
      const updated = await apiPatch<Ticket>(`/api/v1/tickets/${ticket.id}`, {
        status: option.id,
      });
      return { ...ticket, ...updated };
    });
  }

  async function handleCategorySelect(option: SearchableOption) {
    const nextCategoryId = isUnassignedOption(option.id) ? null : option.id;
    const nextSubcategoryId =
      nextCategoryId &&
      ticket.subcategory_id &&
      activeSubcategories.some((sub) => sub.id === ticket.subcategory_id)
        ? ticket.subcategory_id
        : null;
    await runSave(() =>
      apiPatch<TicketDetail>(`/api/v1/tickets/${ticket.id}/metadata`, {
        category_id: nextCategoryId,
        subcategory_id: nextSubcategoryId,
      }),
    );
  }

  async function handleSubcategorySelect(option: SearchableOption) {
    if (!ticket.category_id) {
      setError("Vælg kategori først.");
      return;
    }
    const nextSubcategoryId = isUnassignedOption(option.id) ? null : option.id;
    await runSave(() =>
      apiPatch<TicketDetail>(`/api/v1/tickets/${ticket.id}/metadata`, {
        subcategory_id: nextSubcategoryId,
      }),
    );
  }

  async function handlePrioritySelect(option: SearchableOption) {
    if (isUnassignedOption(option.id) || option.id === ticket.priority) {
      return;
    }
    await runSave(() =>
      apiPatch<TicketDetail>(`/api/v1/tickets/${ticket.id}/priority`, {
        priority: option.id,
        reason: METADATA_FIELD_CHANGE_REASON,
      }),
    );
  }

  async function handleTypeSelect(option: SearchableOption) {
    if (isUnassignedOption(option.id) || option.id === ticket.ticket_type) {
      return;
    }
    await runSave(() =>
      apiPatch<TicketDetail>(`/api/v1/tickets/${ticket.id}/ticket-type`, {
        ticket_type: option.id,
        reason: METADATA_FIELD_CHANGE_REASON,
      }),
    );
  }

  async function handleSourceSelect(option: SearchableOption) {
    if (isUnassignedOption(option.id) || option.id === ticket.source) {
      return;
    }
    await runSave(() =>
      apiPatch<TicketDetail>(`/api/v1/tickets/${ticket.id}/metadata`, {
        source: option.id,
      }),
    );
  }

  async function handleTeamSelect(option: SearchableOption) {
    const nextTeamId = isUnassignedOption(option.id) ? null : option.id;
    let nextUserId = ticket.assigned_user_id;
    if (nextTeamId === null) {
      nextUserId = null;
    } else if (nextUserId) {
      const person = findPersonByUserId(deskPeople, nextUserId);
      if (!person || person.teamId !== nextTeamId) {
        nextUserId = null;
      }
    }
    await runSave(() =>
      apiPatch<TicketDetail>(`/api/v1/tickets/${ticket.id}/assignment`, {
        assigned_team_id: nextTeamId,
        assigned_user_id: nextUserId,
      }),
    );
  }

  async function handleUserSelect(option: SearchableOption) {
    if (isUnassignedOption(option.id)) {
      await runSave(() =>
        apiPatch<TicketDetail>(`/api/v1/tickets/${ticket.id}/assignment`, {
          assigned_user_id: null,
        }),
      );
      return;
    }
    const person = findPersonByUserId(deskPeople, option.id);
    if (!person) {
      return;
    }
    const nextTeamId = ticket.assigned_team_id ?? person.teamId;
    await runSave(() =>
      apiPatch<TicketDetail>(`/api/v1/tickets/${ticket.id}/assignment`, {
        assigned_team_id: nextTeamId,
        assigned_user_id: person.userId,
      }),
    );
  }

  return (
    <>
      <MetadataRow label="Status">
        <SearchableSelect
          valueId={ticket.status}
          displayValue={statusLabel(ticket.status)}
          options={statusOptions}
          placeholder="Søg status…"
          emptyLabel="—"
          allowClear={false}
          disabled={isSaving}
          onQueryChange={setStatusQuery}
          onSelect={handleStatusSelect}
        />
      </MetadataRow>
      <MetadataRow label="Kategori">
        <SearchableSelect
          valueId={ticket.category_id}
          displayValue={ticket.category_name_da ?? "—"}
          options={categoryOptions}
          placeholder="Søg kategori…"
          emptyLabel="Ingen kategori"
          disabled={isSaving}
          onQueryChange={setCategoryQuery}
          onSelect={handleCategorySelect}
        />
      </MetadataRow>
      <MetadataRow label="Underkategori">
        <SearchableSelect
          valueId={ticket.subcategory_id}
          displayValue={ticket.subcategory_name_da ?? "—"}
          options={subcategoryOptions}
          placeholder={
            ticket.category_id ? "Søg underkategori…" : "Vælg kategori først"
          }
          emptyLabel="Ingen underkategori"
          disabled={isSaving || !ticket.category_id}
          onQueryChange={setSubcategoryQuery}
          onSelect={handleSubcategorySelect}
        />
      </MetadataRow>
      <MetadataRow label="Prioritet">
        <SearchableSelect
          valueId={ticket.priority}
          displayValue={priorityLabel(ticket.priority)}
          options={priorityOptions}
          placeholder="Søg prioritet…"
          emptyLabel="—"
          allowClear={false}
          disabled={isSaving}
          onQueryChange={setPriorityQuery}
          onSelect={handlePrioritySelect}
        />
      </MetadataRow>
      <MetadataRow label="Type">
        <SearchableSelect
          valueId={ticket.ticket_type}
          displayValue={ticketTypeLabel(ticket.ticket_type)}
          options={typeOptions}
          placeholder="Søg type…"
          emptyLabel="—"
          allowClear={false}
          disabled={isSaving}
          onQueryChange={setTypeQuery}
          onSelect={handleTypeSelect}
        />
      </MetadataRow>
      <MetadataRow label="Kilde">
        <SearchableSelect
          valueId={ticket.source ?? null}
          displayValue={ticket.source_label_da ?? ticketSourceLabelDa(ticket.source)}
          options={sourceOptions}
          placeholder="Søg kilde…"
          emptyLabel="—"
          allowClear={false}
          disabled={isSaving}
          onQueryChange={setSourceQuery}
          onSelect={handleSourceSelect}
        />
      </MetadataRow>
      <MetadataRow label="Gruppe">
        <SearchableSelect
          valueId={ticket.assigned_team_id}
          displayValue={ticket.assigned_team_name ?? "—"}
          options={teamOptions}
          placeholder="Søg gruppe…"
          emptyLabel="Ingen gruppe"
          disabled={isSaving}
          onQueryChange={setTeamQuery}
          onSelect={handleTeamSelect}
        />
      </MetadataRow>
      <MetadataRow label="Sagsbehandler">
        <SearchableSelect
          valueId={ticket.assigned_user_id}
          displayValue={ticket.assigned_user_name ?? "—"}
          options={userOptions}
          placeholder={
            ticket.assigned_team_id ? "Søg i gruppen…" : "Søg navn eller gruppe…"
          }
          emptyLabel="Ikke tildelt person"
          disabled={isSaving}
          onQueryChange={setUserQuery}
          onSelect={handleUserSelect}
        />
      </MetadataRow>
      <MetadataRow label="SLA">
        <div className="flex justify-end">
          <SlaCountdown
            status={ticket.status}
            resolutionDueAt={ticket.resolution_due_at}
            slaRemainingSeconds={ticket.sla_remaining_seconds}
            slaBreached={ticket.sla_breached}
            compact
          />
        </div>
      </MetadataRow>
      {isSaving ? (
        <p className="text-muted-foreground py-1 text-right text-[11px]">Gemmer…</p>
      ) : null}
      {error ? (
        <p className="text-destructive py-1 text-right text-[11px]" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
