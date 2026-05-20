"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  buildAssignablePeople,
  filterPeopleForSearch,
  filterTeamsForSearch,
  findPersonByUserId,
  isUnassignedOption,
  type SearchableOption,
} from "@/lib/assignment-search";
import { apiPatch } from "@/lib/api";
import { sortTeamsForDisplay } from "@/lib/team-categories";
import type { Team } from "@/types/team";
import type { TicketDetail } from "@/types/ticket";

function MetadataAssignmentRow({
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

export function TicketMetadataAssignment({
  ticketId,
  teams,
  currentTeamId,
  currentTeamName,
  currentUserId,
  currentUserName,
}: {
  ticketId: string;
  teams: Team[];
  currentTeamId: string | null;
  currentTeamName: string | null;
  currentUserId: string | null;
  currentUserName: string | null;
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState(currentTeamId);
  const [teamName, setTeamName] = useState(currentTeamName ?? "");
  const [userId, setUserId] = useState(currentUserId);
  const [userName, setUserName] = useState(currentUserName ?? "");
  const [teamQuery, setTeamQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTeamId(currentTeamId);
    setTeamName(currentTeamName ?? "");
    setUserId(currentUserId);
    setUserName(currentUserName ?? "");
  }, [currentTeamId, currentTeamName, currentUserId, currentUserName]);

  const sortedTeams = useMemo(
    () => sortTeamsForDisplay(teams.filter((team) => team.is_active)),
    [teams],
  );
  const allPeople = useMemo(() => buildAssignablePeople(sortedTeams), [sortedTeams]);

  const teamOptions = useMemo(
    () => filterTeamsForSearch(sortedTeams, teamQuery),
    [sortedTeams, teamQuery],
  );
  const userOptions = useMemo(
    () => filterPeopleForSearch(allPeople, userQuery, teamId),
    [allPeople, userQuery, teamId],
  );

  async function persistAssignment(nextTeamId: string | null, nextUserId: string | null) {
    setIsSaving(true);
    setError(null);
    try {
      const detail = await apiPatch<TicketDetail>(`/api/v1/tickets/${ticketId}/assignment`, {
        assigned_team_id: nextTeamId,
        assigned_user_id: nextUserId,
      });
      setTeamId(detail.assigned_team_id);
      setTeamName(detail.assigned_team_name ?? "");
      setUserId(detail.assigned_user_id);
      setUserName(detail.assigned_user_name ?? "");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme tildeling");
      setTeamId(currentTeamId);
      setTeamName(currentTeamName ?? "");
      setUserId(currentUserId);
      setUserName(currentUserName ?? "");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTeamSelect(option: SearchableOption) {
    const nextTeamId = isUnassignedOption(option.id) ? null : option.id;
    const nextTeamName = isUnassignedOption(option.id) ? "" : option.label;
    let nextUserId = userId;
    let nextUserName = userName;

    if (nextTeamId === null) {
      nextUserId = null;
      nextUserName = "";
    } else if (userId) {
      const person = findPersonByUserId(allPeople, userId);
      if (!person || person.teamId !== nextTeamId) {
        nextUserId = null;
        nextUserName = "";
      }
    }

    setTeamId(nextTeamId);
    setTeamName(nextTeamName);
    setUserId(nextUserId);
    setUserName(nextUserName);
    await persistAssignment(nextTeamId, nextUserId);
  }

  async function handleUserSelect(option: SearchableOption) {
    if (isUnassignedOption(option.id)) {
      setUserId(null);
      setUserName("");
      await persistAssignment(teamId, null);
      return;
    }

    const person = findPersonByUserId(allPeople, option.id);
    if (!person) {
      return;
    }

    const nextTeamId = teamId ?? person.teamId;
    const nextTeamName =
      teamName || sortedTeams.find((team) => team.id === person.teamId)?.name || person.teamName;

    setUserId(person.userId);
    setUserName(person.displayName);
    if (!teamId) {
      setTeamId(person.teamId);
      setTeamName(nextTeamName);
    }
    await persistAssignment(nextTeamId, person.userId);
  }

  return (
    <>
      <MetadataAssignmentRow label="Gruppe">
        <SearchableSelect
          valueId={teamId}
          displayValue={teamName || "—"}
          options={teamOptions}
          placeholder="Søg gruppe…"
          emptyLabel="Ingen gruppe"
          disabled={isSaving}
          onQueryChange={setTeamQuery}
          onSelect={handleTeamSelect}
        />
      </MetadataAssignmentRow>
      <MetadataAssignmentRow label="Sagsbehandler">
        <SearchableSelect
          valueId={userId}
          displayValue={userName || "—"}
          options={userOptions}
          placeholder={teamId ? "Søg i gruppen…" : "Søg navn eller gruppe…"}
          emptyLabel="Ikke tildelt person"
          disabled={isSaving}
          onQueryChange={setUserQuery}
          onSelect={handleUserSelect}
          listId={`${ticketId}-assignee-list`}
        />
      </MetadataAssignmentRow>
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
