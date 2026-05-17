"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiPatch } from "@/lib/api";
import type { Team } from "@/types/team";
import type { TicketDetail } from "@/types/ticket";

const selectClassName =
  "border-input bg-background mt-2 flex h-9 w-full rounded-md border px-3 py-1 text-sm";

const UNASSIGNED = "";

export function TicketAssignmentForm({
  ticketId,
  teams,
  currentTeamId,
  currentUserId,
}: {
  ticketId: string;
  teams: Team[];
  currentTeamId: string | null;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState(currentTeamId ?? UNASSIGNED);
  const [userId, setUserId] = useState(currentUserId ?? UNASSIGNED);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberOptions = useMemo(() => {
    if (teamId === UNASSIGNED) {
      return [];
    }
    return teams.find((team) => team.id === teamId)?.members ?? [];
  }, [teamId, teams]);

  async function handleAssign() {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiPatch<TicketDetail>(`/api/v1/tickets/${ticketId}/assignment`, {
        assigned_team_id: teamId === UNASSIGNED ? null : teamId,
        assigned_user_id: userId === UNASSIGNED ? null : userId,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke tildele sagen");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleTeamChange(nextTeamId: string) {
    setTeamId(nextTeamId);
    if (userId !== UNASSIGNED) {
      const stillMember = teams
        .find((team) => team.id === nextTeamId)
        ?.members.some((member) => member.user_id === userId);
      if (!stillMember) {
        setUserId(UNASSIGNED);
      }
    }
  }

  const unchanged =
    (teamId === UNASSIGNED ? null : teamId) === currentTeamId &&
    (userId === UNASSIGNED ? null : userId) === currentUserId;

  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-sm font-medium">Tildeling</p>
      <div>
        <Label htmlFor="assign-team">Gruppe</Label>
        <select
          id="assign-team"
          className={selectClassName}
          value={teamId}
          onChange={(event) => handleTeamChange(event.target.value)}
        >
          <option value={UNASSIGNED}>Ingen gruppe</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="assign-user">Sagsbehandler</Label>
        <select
          id="assign-user"
          className={selectClassName}
          value={userId}
          disabled={teamId === UNASSIGNED}
          onChange={(event) => setUserId(event.target.value)}
        >
          <option value={UNASSIGNED}>Ikke tildelt person</option>
          {memberOptions.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.display_name}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <Button
        type="button"
        size="sm"
        className="w-full"
        disabled={isSubmitting || unchanged}
        onClick={handleAssign}
      >
        {isSubmitting ? "Gemmer…" : "Gem tildeling"}
      </Button>
    </div>
  );
}